const AlertService = require('./AlertService');
const BTCCClient = require('../api/btcc/BTCCClient');
const logger = require('../utils/logger');

class BacktestService {
    constructor(config) {
        this.config = {
            startDate: config.startDate,
            endDate: config.endDate,
            initialBalance: config.initialBalance || 10000,
            strategies: config.strategies || ['Brinks Box', 'EMA Cross'],
            timeframes: config.timeframes || ['15m', '1h'],
            symbols: config.symbols || ['BTC-USD'],
            ...config
        };
        
        this.results = {
            trades: [],
            metrics: {},
            balance: this.config.initialBalance,
            winRate: 0,
            maxDrawdown: 0
        };
    }

    async run() {
        logger.info(`Starting backtest from ${this.config.startDate} to ${this.config.endDate}`);

        try {
            // Get historical data
            const historicalData = await this.fetchHistoricalData();
            
            // Simulate alerts and trades
            for (const dataPoint of historicalData) {
                await this.processTimeframe(dataPoint);
            }

            // Calculate final metrics
            this.calculateMetrics();

            return this.results;

        } catch (error) {
            logger.error(`Backtest error: ${error.message}`);
            throw error;
        }
    }

    async fetchHistoricalData() {
        const btccClient = new BTCCClient();
        const data = [];

        for (const symbol of this.config.symbols) {
            for (const timeframe of this.config.timeframes) {
                const candles = await btccClient.getHistoricalData({
                    symbol,
                    timeframe,
                    start: this.config.startDate,
                    end: this.config.endDate
                });
                data.push(...candles);
            }
        }

        return data.sort((a, b) => a.timestamp - b.timestamp);
    }

    async processTimeframe(dataPoint) {
        for (const strategy of this.config.strategies) {
            const alert = this.generateAlert(strategy, dataPoint);
            
            if (alert) {
                // Mock the current price in the global scope
                global.mockCurrentPrice = dataPoint.close;

                // Process alert through the actual AlertService
                try {
                    const result = await AlertService.handleAlert(alert);
                    if (result && result.success) {
                        this.recordTrade({
                            strategy,
                            entry: dataPoint.close,
                            timestamp: dataPoint.timestamp,
                            ...result
                        });
                    }
                } catch (error) {
                    logger.error(`Alert processing error: ${error.message}`);
                }
            }
        }
    }

    generateAlert(strategy, candle) {
        switch (strategy) {
            case 'Brinks Box':
                return this.generateBrinksBoxAlert(candle);
            case 'EMA Cross':
                return this.generateEmaCrossAlert(candle);
            // Add other strategy alert generators
            default:
                return null;
        }
    }

    generateBrinksBoxAlert(candle) {
        // Example Brinks Box alert generation logic
        return {
            strategy: 'Brinks Box',
            alert_type: candle.close > candle.brinks_high ? 'brinks_box_long' : 'brinks_box_short',
            symbol: candle.symbol,
            timeframe: candle.timeframe,
            price: candle.close,
            volume: candle.volume,
            average_volume: candle.average_volume,
            brinks_high: candle.brinks_high,
            brinks_low: candle.brinks_low,
            session: this.determineSession(candle.timestamp)
        };
    }

    recordTrade(trade) {
        this.results.trades.push(trade);
        this.updateBalance(trade);
    }

    updateBalance(trade) {
        // Calculate PnL and update balance
        const pnl = this.calculatePnL(trade);
        this.results.balance += pnl;
        
        // Update max drawdown
        const drawdown = this.calculateDrawdown();
        this.results.maxDrawdown = Math.min(this.results.maxDrawdown, drawdown);
    }

    calculateMetrics() {
        const trades = this.results.trades;
        
        this.results.metrics = {
            totalTrades: trades.length,
            winningTrades: trades.filter(t => t.pnl > 0).length,
            losingTrades: trades.filter(t => t.pnl < 0).length,
            winRate: (trades.filter(t => t.pnl > 0).length / trades.length) * 100,
            averagePnL: trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length,
            maxDrawdown: this.results.maxDrawdown,
            sharpeRatio: this.calculateSharpeRatio(),
            profitFactor: this.calculateProfitFactor()
        };
    }

    determineSession(timestamp) {
        const date = new Date(timestamp);
        const hour = date.getUTCHours();

        // Define trading sessions
        if (hour >= 0 && hour < 8) return 'ASIA';
        if (hour >= 8 && hour < 16) return 'LONDON';
        return 'NEW_YORK';
    }

    generateEmaCrossAlert(candle) {
        return {
            strategy: 'EMA Cross',
            alert_type: candle.ema_50 > candle.ema_200 ? 'ema_cross_long' : 'ema_cross_short',
            symbol: candle.symbol,
            timeframe: candle.timeframe,
            price: candle.close,
            ema_50: candle.ema_50,
            ema_200: candle.ema_200,
            session: this.determineSession(candle.timestamp)
        };
    }

    calculatePnL(trade) {
        const { entry, exit, size, leverage = 1, direction } = trade;
        if (!exit) return 0;

        const multiplier = direction === 'long' ? 1 : -1;
        return (exit - entry) * size * leverage * multiplier;
    }

    calculateDrawdown() {
        const { trades } = this.results;
        if (trades.length === 0) return 0;

        let peak = this.config.initialBalance;
        let maxDrawdown = 0;

        trades.forEach(trade => {
            const currentBalance = this.results.balance;
            peak = Math.max(peak, currentBalance);
            const drawdown = (peak - currentBalance) / peak * 100;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        });

        return maxDrawdown;
    }

    calculateSharpeRatio() {
        const { trades } = this.results;
        if (trades.length < 2) return 0;

        const returns = trades.map(t => t.pnl / this.config.initialBalance);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const stdDev = Math.sqrt(
            returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1)
        );

        // Annualized Sharpe Ratio (assuming daily returns)
        return (avgReturn * 252) / (stdDev * Math.sqrt(252));
    }

    calculateProfitFactor() {
        const { trades } = this.results;
        const grossProfit = trades
            .filter(t => t.pnl > 0)
            .reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(
            trades
                .filter(t => t.pnl < 0)
                .reduce((sum, t) => sum + t.pnl, 0)
        );

        return grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    }
}

module.exports = BacktestService;