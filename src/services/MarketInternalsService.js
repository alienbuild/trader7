const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class MarketInternalsService {
    static async saveMarketInternals(data) {
        try {
            return await prisma.nasdaqMarketInternals.create({
                data: {
                    tick: data.tick,
                    add: data.add,
                    trin: data.trin,
                    vix: data.vix
                }
            });
        } catch (error) {
            logger.error(`Failed to save market internals: ${error.message}`);
            throw error;
        }
    }

    static async getLatestInternals() {
        try {
            return await prisma.nasdaqMarketInternals.findFirst({
                orderBy: {
                    timestamp: 'desc'
                }
            });
        } catch (error) {
            logger.error(`Failed to fetch latest market internals: ${error.message}`);
            throw error;
        }
    }

    static async getThresholds() {
        try {
            const thresholds = await prisma.marketInternalThreshold.findMany({
                where: {
                    marketType: 'NASDAQ',
                    isActive: true
                }
            });

            return thresholds.reduce((acc, threshold) => {
                acc[threshold.indicatorName.toLowerCase()] = {
                    long: threshold.longThreshold,
                    short: threshold.shortThreshold
                };
                return acc;
            }, {});
        } catch (error) {
            logger.error(`Failed to fetch market internal thresholds: ${error.message}`);
            throw error;
        }
    }

    static async validateMarketInternals(direction) {
        try {
            const [internals, thresholds] = await Promise.all([
                this.getLatestInternals(),
                this.getThresholds()
            ]);

            if (!internals || !thresholds) return false;

            if (direction === 'buy') {
                return (
                    internals.tick > thresholds.tick.long &&
                    internals.add > thresholds.add.long &&
                    internals.trin < thresholds.trin.long &&
                    internals.vix < thresholds.vix.long
                );
            } else {
                return (
                    internals.tick < thresholds.tick.short &&
                    internals.add < thresholds.add.short &&
                    internals.trin > thresholds.trin.short &&
                    internals.vix > thresholds.vix.short
                );
            }
        } catch (error) {
            logger.error(`Failed to validate market internals: ${error.message}`);
            return false;
        }
    }

    static async getMarketInternalsHistory(timeframe = '1d') {
        try {
            const startTime = this._getStartTimeForTimeframe(timeframe);
            
            return await prisma.nasdaqMarketInternals.findMany({
                where: {
                    timestamp: {
                        gte: startTime
                    }
                },
                orderBy: {
                    timestamp: 'asc'
                }
            });
        } catch (error) {
            logger.error(`Failed to fetch market internals history: ${error.message}`);
            throw error;
        }
    }

    static async calculateMarketInternalsScore() {
        try {
            const internals = await this.getLatestInternals();
            if (!internals) return 0;

            // Calculate weighted score based on multiple factors
            const tickScore = this._normalizeValue(internals.tick, -1000, 1000) * 0.3;
            const addScore = this._normalizeValue(internals.add, -2000, 2000) * 0.3;
            const trinScore = (1 - this._normalizeValue(internals.trin, 0.5, 2)) * 0.2;
            const vixScore = (1 - this._normalizeValue(internals.vix, 10, 30)) * 0.2;

            return (tickScore + addScore + trinScore + vixScore) * 100;
        } catch (error) {
            logger.error(`Failed to calculate market internals score: ${error.message}`);
            return 0;
        }
    }

    static _normalizeValue(value, min, max) {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    static _getStartTimeForTimeframe(timeframe) {
        const now = new Date();
        switch (timeframe) {
            case '1h':
                return new Date(now.setHours(now.getHours() - 1));
            case '4h':
                return new Date(now.setHours(now.getHours() - 4));
            case '1d':
                return new Date(now.setDate(now.getDate() - 1));
            case '1w':
                return new Date(now.setDate(now.getDate() - 7));
            default:
                return new Date(now.setDate(now.getDate() - 1));
        }
    }

    static async updateThresholds(newThresholds) {
        try {
            const updates = Object.entries(newThresholds).map(([indicator, values]) => {
                return prisma.marketInternalThreshold.upsert({
                    where: {
                        marketType_indicatorName: {
                            marketType: 'NASDAQ',
                            indicatorName: indicator.toUpperCase()
                        }
                    },
                    update: {
                        longThreshold: values.long,
                        shortThreshold: values.short,
                        isActive: true
                    },
                    create: {
                        marketType: 'NASDAQ',
                        indicatorName: indicator.toUpperCase(),
                        longThreshold: values.long,
                        shortThreshold: values.short,
                        isActive: true
                    }
                });
            });

            await prisma.$transaction(updates);
            return true;
        } catch (error) {
            logger.error(`Failed to update market internal thresholds: ${error.message}`);
            throw error;
        }
    }

    static async getMarketInternalsAnalysis() {
        try {
            const [latestInternals, thresholds] = await Promise.all([
                this.getLatestInternals(),
                this.getThresholds()
            ]);

            if (!latestInternals || !thresholds) {
                throw new Error('Required data not available');
            }

            const analysis = {
                timestamp: latestInternals.timestamp,
                indicators: {
                    tick: {
                        value: latestInternals.tick,
                        status: this._getIndicatorStatus(
                            latestInternals.tick,
                            thresholds.tick.short,
                            thresholds.tick.long
                        )
                    },
                    add: {
                        value: latestInternals.add,
                        status: this._getIndicatorStatus(
                            latestInternals.add,
                            thresholds.add.short,
                            thresholds.add.long
                        )
                    },
                    trin: {
                        value: latestInternals.trin,
                        status: this._getIndicatorStatus(
                            latestInternals.trin,
                            thresholds.trin.long,  // Note: TRIN is inverted
                            thresholds.trin.short
                        )
                    },
                    vix: {
                        value: latestInternals.vix,
                        status: this._getIndicatorStatus(
                            latestInternals.vix,
                            thresholds.vix.long,  // Note: VIX is inverted
                            thresholds.vix.short
                        )
                    }
                },
                overallScore: await this.calculateMarketInternalsScore()
            };

            analysis.marketSentiment = this._determineMarketSentiment(analysis);
            return analysis;

        } catch (error) {
            logger.error(`Failed to generate market internals analysis: ${error.message}`);
            throw error;
        }
    }

    static _getIndicatorStatus(value, shortThresh, longThresh) {
        if (value > longThresh) return 'bullish';
        if (value < shortThresh) return 'bearish';
        return 'neutral';
    }

    static _determineMarketSentiment(analysis) {
        const indicators = analysis.indicators;
        const bullishCount = Object.values(indicators)
            .filter(ind => ind.status === 'bullish').length;
        const bearishCount = Object.values(indicators)
            .filter(ind => ind.status === 'bearish').length;

        if (bullishCount >= 3) return 'strongly_bullish';
        if (bullishCount >= 2) return 'moderately_bullish';
        if (bearishCount >= 3) return 'strongly_bearish';
        if (bearishCount >= 2) return 'moderately_bearish';
        return 'neutral';
    }
}

module.exports = MarketInternalsService;
