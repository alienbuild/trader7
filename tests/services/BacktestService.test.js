const { jest, describe, it, expect, beforeEach } = require('@jest/globals');
const BacktestService = require('../../src/services/BacktestService');
const BTCCClient = require('../../src/api/btcc/BTCCClient');
const AlertService = require('../../src/services/AlertService');
const { generateTestData, generateCompleteTestSet } = require('../fixtures/testData');

jest.mock('../../src/api/btcc/BTCCClient');
jest.mock('../../src/services/AlertService');

describe('BacktestService', () => {
    let backtestService;
    const mockConfig = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialBalance: 10000,
        strategies: ['Brinks Box'],
        timeframes: ['15m'],
        symbols: ['BTC-USD'],
        sessions: ['LONDON', 'NEW_YORK', 'ASIA']
    };

    beforeEach(() => {
        backtestService = new BacktestService(mockConfig);
        jest.clearAllMocks();
    });

    describe('run()', () => {
        it('should execute backtest successfully', async () => {
            const testData = generateCompleteTestSet(
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );
            
            BTCCClient.prototype.getHistoricalData = jest.fn().mockResolvedValue(testData);
            
            const result = await backtestService.run();
            
            expect(result).toHaveProperty('metrics');
            expect(result).toHaveProperty('trades');
            expect(result.metrics).toHaveProperty('winRate');
            expect(result.metrics).toHaveProperty('sharpeRatio');
            expect(result.metrics).toHaveProperty('maxDrawdown');
        });

        it('should handle errors during backtest', async () => {
            BTCCClient.prototype.getHistoricalData = jest.fn().mockRejectedValue(
                new Error('API Error')
            );

            await expect(backtestService.run()).rejects.toThrow('API Error');
        });

        it('should respect session trading hours', async () => {
            const testData = generateTestData(
                new Date('2024-01-01'),
                new Date('2024-01-02'),
                '15m'
            );
            
            BTCCClient.prototype.getHistoricalData = jest.fn().mockResolvedValue(testData);
            
            const result = await backtestService.run();
            
            // Verify trades only occurred during configured sessions
            result.trades.forEach(trade => {
                const tradeHour = new Date(trade.timestamp).getUTCHours();
                const validSessionHours = trade.session === 'LONDON' ? 
                    (tradeHour >= 8 && tradeHour < 16) : 
                    trade.session === 'NEW_YORK' ? 
                    (tradeHour >= 16 || tradeHour < 0) :
                    (tradeHour >= 0 && tradeHour < 8);
                    
                expect(validSessionHours).toBe(true);
            });
        });
    });

    describe('metrics calculations', () => {
        it('should calculate PnL correctly', () => {
            const trades = [
                {
                    entry: 42000,
                    exit: 42500,
                    size: 1,
                    leverage: 2
                },
                {
                    entry: 43000,
                    exit: 42500,
                    size: 1,
                    leverage: 2
                },
                {
                    entry: 41000,
                    exit: 41500,
                    size: 1,
                    leverage: 2
                }
            ];

            const pnl = backtestService.calculatePnL(trades);
            expect(pnl).toBe(1000); // (42500 - 42000) * 1 * 2
        });

        it('should calculate drawdown correctly', () => {
            backtestService.results.trades = [
                { pnl: 1000, timestamp: new Date('2024-01-01').getTime() },
                { pnl: -500, timestamp: new Date('2024-01-02').getTime() },
                { pnl: -300, timestamp: new Date('2024-01-03').getTime() }
            ];
            backtestService.results.balance = 10200;
            
            const drawdown = backtestService.calculateDrawdown();
            expect(drawdown).toBeCloseTo(7.84, 2);
            
            // Test maximum drawdown is updated correctly
            expect(backtestService.results.maxDrawdown).toBeLessThanOrEqual(drawdown);
        });

        it('should calculate Sharpe ratio correctly', () => {
            const trades = [
                { pnl: 500, timestamp: new Date('2024-01-01').getTime() },
                { pnl: 300, timestamp: new Date('2024-01-02').getTime() },
                { pnl: -200, timestamp: new Date('2024-01-03').getTime() },
                { pnl: 400, timestamp: new Date('2024-01-04').getTime() }
            ];
            
            backtestService.results.trades = trades;
            const sharpeRatio = backtestService.calculateSharpeRatio();
            
            expect(sharpeRatio).toBeGreaterThan(0);
            expect(typeof sharpeRatio).toBe('number');
            expect(Number.isFinite(sharpeRatio)).toBe(true);
        });

        it('should calculate profit factor correctly', () => {
            const trades = [
                { pnl: 500, timestamp: new Date('2024-01-01').getTime() },
                { pnl: -200, timestamp: new Date('2024-01-02').getTime() },
                { pnl: 300, timestamp: new Date('2024-01-03').getTime() },
                { pnl: -100, timestamp: new Date('2024-01-04').getTime() }
            ];
            
            backtestService.results.trades = trades;
            const profitFactor = backtestService.calculateProfitFactor();
            
            expect(profitFactor).toBe(2.67); // (500 + 300) / (200 + 100)
        });
    });

    describe('session determination and trading hours', () => {
        it('should correctly identify all trading sessions', () => {
            const testCases = [
                { timestamp: '2024-01-01T02:00:00Z', expected: 'ASIA' },
                { timestamp: '2024-01-01T10:00:00Z', expected: 'LONDON' },
                { timestamp: '2024-01-01T18:00:00Z', expected: 'NEW_YORK' },
                { timestamp: '2024-01-01T23:59:59Z', expected: 'NEW_YORK' },
                { timestamp: '2024-01-01T07:59:59Z', expected: 'ASIA' },
                { timestamp: '2024-01-01T15:59:59Z', expected: 'LONDON' }
            ];

            testCases.forEach(({ timestamp, expected }) => {
                const session = backtestService.determineSession(new Date(timestamp).getTime());
                expect(session).toBe(expected);
            });
        });

        it('should validate Brinks Box trading hours correctly', () => {
            const testCases = [
                { 
                    timestamp: '2024-01-01T14:30:00Z', // 14:30 GMT - Valid Brinks Box time
                    expectedValid: true 
                },
                { 
                    timestamp: '2024-01-01T13:59:00Z', // 13:59 GMT - Before Brinks Box
                    expectedValid: false 
                },
                { 
                    timestamp: '2024-01-01T15:01:00Z', // 15:01 GMT - After Brinks Box
                    expectedValid: false 
                }
            ];

            testCases.forEach(({ timestamp, expectedValid }) => {
                const candle = {
                    timestamp: new Date(timestamp).getTime(),
                    symbol: 'BTC-USD',
                    timeframe: '15m',
                    close: 42300,
                    volume: 100,
                    brinks_high: 42200,
                    brinks_low: 41800
                };

                const isValid = backtestService.isValidBrinksBoxTime(candle.timestamp);
                expect(isValid).toBe(expectedValid);
            });
        });
    });

    describe('Brinks Box strategy', () => {
        it('should generate correct Brinks Box alerts during valid session times', () => {
            const validBrinksTime = new Date('2024-01-01T07:30:00Z'); // During London session
            const candle = {
                timestamp: validBrinksTime.getTime(),
                symbol: 'BTC-USD',
                timeframe: '15m',
                close: 42300,
                volume: 100,
                average_volume: 80,
                brinks_high: 42200,
                brinks_low: 41800,
                ema_50: 42100,
                ema_200: 41900
            };

            const alert = backtestService.generateBrinksBoxAlert(candle);
            
            expect(alert).toEqual({
                strategy: 'Brinks Box',
                alert_type: 'brinks_box_long',
                symbol: 'BTC-USD',
                timeframe: '15m',
                price: 42300,
                volume: 100,
                average_volume: 80,
                brinks_high: 42200,
                brinks_low: 41800,
                session: 'ASIA'
            });
        });

        it('should generate short signals when price closes below brinks low', () => {
            const candle = {
                timestamp: new Date('2024-01-01T10:00:00Z').getTime(),
                symbol: 'BTC-USD',
                timeframe: '15m',
                close: 41700,
                volume: 120,
                average_volume: 80,
                brinks_high: 42200,
                brinks_low: 41800,
                ema_50: 41900,
                ema_200: 42100
            };

            const alert = backtestService.generateBrinksBoxAlert(candle);
            
            expect(alert.alert_type).toBe('brinks_box_short');
            expect(alert.session).toBe('LONDON');
        });

        it('should handle multiple timeframes correctly', () => {
            const timeframes = ['15m', '1h'];
            const candles = timeframes.map(timeframe => ({
                timestamp: new Date('2024-01-01T10:00:00Z').getTime(),
                symbol: 'BTC-USD',
                timeframe,
                close: 42300,
                volume: 100,
                average_volume: 80,
                brinks_high: 42200,
                brinks_low: 41800
            }));

            candles.forEach(candle => {
                const alert = backtestService.generateBrinksBoxAlert(candle);
                expect(alert.timeframe).toBe(candle.timeframe);
            });
        });
    });

    describe('strategy validation', () => {
        it('should validate volume requirements', () => {
            const testCases = [
                {
                    volume: 200,
                    average_volume: 100,
                    expectedValid: true,
                    description: 'Volume above threshold'
                },
                {
                    volume: 150,
                    average_volume: 100,
                    expectedValid: false,
                    description: 'Volume below threshold'
                }
            ];

            testCases.forEach(({ volume, average_volume, expectedValid, description }) => {
                const candle = {
                    timestamp: new Date('2024-01-01T14:30:00Z').getTime(),
                    symbol: 'BTC-USD',
                    timeframe: '15m',
                    close: 42300,
                    volume,
                    average_volume,
                    brinks_high: 42200,
                    brinks_low: 41800
                };

                const hasVolume = backtestService.hasVolumeConfirmation(candle);
                expect(hasVolume).toBe(expectedValid, description);
            });
        });

        it('should validate EMA alignment', () => {
            const testCases = [
                {
                    close: 42500,
                    ema_50: 42300,
                    ema_200: 42100,
                    expectedDirection: 'long',
                    description: 'Valid long setup'
                },
                {
                    close: 41800,
                    ema_50: 42000
                }
            ];

            testCases.forEach(({ close, ema_50, ema_200, expectedDirection, description }) => {
                const candle = {
                    timestamp: new Date('2024-01-01T14:30:00Z').getTime(),
                    symbol: 'BTC-USD',
                    timeframe: '15m',
                    close,
                    volume: 100,
                    average_volume: 80,
                    brinks_high: 42200,
                    brinks_low: 41800,
                    ema_50,
                    ema_200
                };

                const isValid = backtestService.isValidBrinksBoxTime(candle.timestamp);
                expect(isValid).toBe(expectedValid, description);
            });
        });
    });

    describe('performance metrics', () => {
        beforeEach(() => {
            backtestService.results.trades = [
                { entry: 40000, exit: 41000, size: 1, leverage: 1, direction: 'long', pnl: 1000 },
                { entry: 41000, exit: 40500, size: 1, leverage: 1, direction: 'long', pnl: -500 },
                { entry: 40500, exit: 41500, size: 1, leverage: 1, direction: 'long', pnl: 1000 }
            ];
        });

        it('should calculate correct win rate', () => {
            backtestService.calculateMetrics();
            expect(backtestService.results.metrics.winRate).toBe(66.67);
        });

        it('should calculate correct average PnL', () => {
            backtestService.calculateMetrics();
            expect(backtestService.results.metrics.averagePnL).toBe(500);
        });

        it('should handle empty trade list', () => {
            backtestService.results.trades = [];
            backtestService.calculateMetrics();
            
            expect(backtestService.results.metrics).toEqual({
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                averagePnL: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                profitFactor: 0
            });
        });
    });

    describe('vector analysis and box formation', () => {
        it('should validate vector analysis conditions', () => {
            const testCases = [
                {
                    scenario: 'Valid unrecovered vector',
                    candle: {
                        timestamp: new Date('2024-01-01T14:30:00Z').getTime(),
                        open: 42000,
                        high: 42500,
                        low: 41800,
                        close: 41900,
                        volume: 200
                    },
                    expectedValid: true
                },
                {
                    scenario: 'Invalid unrecovered vector',
                    candle: {
                        timestamp: new Date('2024-01-01T14:30:00Z').getTime(),
                        open: 42000,
                        high: 42500,
                        low: 41800,
                        close: 42100,
                        volume: 200
                    },
                    expectedValid: false
                },
                {
                    scenario: 'Invalid volume',
                    candle: {
                        timestamp: new Date('2024-01-01T14:30:00Z').getTime(),
                        open: 42000,
                        high: 42500,
                        low: 41800,
                        close: 41900,
                        volume: 100
                    },
                    expectedValid: false
                },
                {
                    scenario: 'Invalid Brinks Box time',
                    candle: {
                        timestamp: new Date('2024-01-01T13:30:00Z').getTime(),
                        open: 42000,
                        high: 42500,
                        low: 41800,
                        close: 41900,
                        volume: 200
                    },
                    expectedValid: false
                }
            ];

            testCases.forEach(({ scenario, candle, expectedValid }) => {
                const isValid = backtestService.validate(candle);
                expect(isValid).toBe(expectedValid, scenario);
            });
        });

        it('should validate vector analysis conditions', () => {
            const testCases = [
                {
                    scenario: 'Valid unrecovered vector',
                    candles: [
                        {
                            timestamp: new Date('2024-01-01T14:15:00Z').getTime(),
                            open: 42000,
                            high: 42500,
                            low: 41800,
                            close: 41900,
                            volume: 200
                        },
                        {
                            timestamp: new Date('2024-01-01T14:30:00Z').getTime(),
                            open: 41900,
                            high: 42100,
                            low: 41800,
                            close: 42000,
                            volume: 150
                        }
                    ],
                    expectedVectors: 1,
                    expectedDirection: 'down'
                },
                {
                    scenario: 'No unrecovered vectors',
                    candles: [
                        {
                            timestamp: new Date('2024-01-01T14:15:00Z').getTime(),
                            open: 42000,
                            high: 42200,
                            low: 41900,
                            close: 42100,
                            volume: 120
                        },
                        {
                            timestamp: new Date('2024-01-01T14:30:00Z').getTime(),
                            open: 42100,
                            high: 42300,
                            low: 42000,
                            close: 42200,
                            volume: 100
                        }
                    ],
                    expectedVectors: 0,
                    expectedDirection: null
                }
            ];

            testCases.forEach(({ scenario, candles, expectedVectors, expectedDirection }) => {
                const vectors = backtestService.findUnrecoveredVectors(candles);
                expect(vectors.length).toBe(expectedVectors, scenario);
                if (expectedDirection) {
                    expect(vectors[0].direction).toBe(expectedDirection);
                }
            });
        });

        it('should validate box formation completion', () => {
            const testCases = [
                {
                    scenario: 'Complete box formation',
                    candles: [
                        {
                            timestamp: new Date('2024-01-01T14:00:00Z').getTime(),
                            high: 42200,
                            low: 41800,
                            brinks_high: 42200,
                            brinks_low: 41800
                        },
                        {
                            timestamp: new Date('2024-01-01T14:15:00Z').getTime(),
                            high: 42150,
                            low: 41850,
                            brinks_high: 42200,
                            brinks_low: 41800
                        }
                    ],
                    expectedComplete: true
                },
                {
                    scenario: 'Incomplete box formation',
                    candles: [
                        {
                            timestamp: new Date('2024-01-01T14:00:00Z').getTime(),
                            high: 42300,
                            low: 41700,
                            brinks_high: null,
                            brinks_low: null
                        }
                    ],
                    expectedComplete: false
                }
            ];

            testCases.forEach(({ scenario, candles, expectedComplete }) => {
                const isComplete = backtestService.isBoxComplete(candles);
                expect(isComplete).toBe(expectedComplete, scenario);
            });
        });

        it('should validate session phase detection', () => {
            const testCases = [
                {
                    timestamp: '2024-01-01T14:15:00Z',
                    expectedPhase: 'OPENING',
                    description: 'First 30 minutes of session'
                },
                {
                    timestamp: '2024-01-01T15:30:00Z',
                    expectedPhase: 'MIDDLE',
                    description: 'Middle of session'
                },
                {
                    timestamp: '2024-01-01T15:45:00Z',
                    expectedPhase: 'CLOSING',
                    description: 'Last 30 minutes of session'
                }
            ];

            testCases.forEach(({ timestamp, expectedPhase, description }) => {
                const phase = backtestService.determineSessionPhase(new Date(timestamp).getTime());
                expect(phase).toBe(expectedPhase, description);
            });
        });
    });
});