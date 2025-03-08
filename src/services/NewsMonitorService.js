const EventEmitter = require('events');
const logger = require('../utils/logger');
const {newsProviders, highImpactEvents, sentimentAnalysis} = require("../../frontend/postcss.config.mjs");

class NewsMonitorService extends EventEmitter {
    constructor(newsEventService, newsAnalysisService) {
        super();
        this.newsEventService = newsEventService;
        this.newsAnalysisService = newsAnalysisService;
        this.monitoringIntervals = new Map();
    }

    async startMonitoring(symbol) {
        if (this.monitoringIntervals.has(symbol)) {
            return;
        }

        const interval = setInterval(async () => {
            try {
                const newsUpdate = await this.checkForNewsUpdates(symbol);
                if (newsUpdate.hasNewEvents) {
                    this.emit('newsUpdate', {
                        symbol,
                        events: newsUpdate.events,
                        tradingImpact: newsUpdate.tradingImpact
                    });
                }
            } catch (error) {
                logger.error(`News monitoring error for ${symbol}: ${error.message}`);
            }
        }, newsProviders.refreshInterval);

        this.monitoringIntervals.set(symbol, interval);
    }

    async stopMonitoring(symbol) {
        const interval = this.monitoringIntervals.get(symbol);
        if (interval) {
            clearInterval(interval);
            this.monitoringIntervals.delete(symbol);
        }
    }

    async checkForNewsUpdates(symbol) {
        const lastCheck = this.lastCheckTimes.get(symbol) || new Date(0);
        const currentTime = new Date();

        // Get news from all providers
        const [bloombergNews, reutersNews, economicNews] = await Promise.all([
            this.newsEventService.getBloombergNews(symbol, lastCheck),
            this.newsEventService.getReutersNews(symbol, lastCheck),
            this.newsEventService.getEconomicNews(symbol, lastCheck)
        ]);

        const newEvents = [...bloombergNews, ...reutersNews, ...economicNews];

        if (newEvents.length > 0) {
            // Analyze trading impact
            const tradingImpact = await this.newsAnalysisService.analyzeSentiment(newEvents);

            // Update last check time
            this.lastCheckTimes.set(symbol, currentTime);

            return {
                hasNewEvents: true,
                events: newEvents,
                tradingImpact
            };
        }

        return { hasNewEvents: false };
    }

    async handleHighImpactEvent(event) {
        try {
            // Analyze event impact
            const impact = await this.newsAnalysisService.shouldBlockTrading(event.symbol);

            if (impact.shouldBlock) {
                // Create trading block
                await this.createTradingBlock({
                    symbol: event.symbol,
                    reason: impact.reason,
                    duration: this.calculateBlockDuration(event),
                    eventId: event.id
                });

                // Emit blocking event
                this.emit('tradingBlocked', {
                    symbol: event.symbol,
                    reason: impact.reason,
                    duration: this.calculateBlockDuration(event),
                    adjustedParameters: impact.adjustedParameters
                });
            }
        } catch (error) {
            logger.error(`Error handling high impact event: ${error.message}`);
        }
    }

    private calculateBlockDuration(event) {
        const eventConfig = highImpactEvents[event.type];
        if (!eventConfig) {
            return 30 * 60 * 1000; // Default 30 minutes if no specific config
        }

        // Calculate total blocking duration (before + after event)
        return (eventConfig.blockingPeriod + eventConfig.waitPeriod) * 60 * 1000;
    }

    private async createTradingBlock(blockData) {
        try {
            await prisma.tradingBlock.create({
                data: {
                    symbol: blockData.symbol,
                    startTime: new Date(),
                    endTime: new Date(Date.now() + blockData.duration),
                    reason: blockData.reason,
                    eventId: blockData.eventId,
                    isActive: true
                }
            });
        } catch (error) {
            logger.error(`Failed to create trading block: ${error.message}`);
            throw error;
        }
    }

    async checkActiveTradingBlocks(symbol) {
        try {
            const activeBlock = await prisma.tradingBlock.findFirst({
                where: {
                    OR: [
                        { symbol: symbol },
                        { symbol: null }, // Global market blocks
                    ],
                    isActive: true,
                    endTime: {
                        gt: new Date()
                    }
                }
            });

            return {
                isBlocked: !!activeBlock,
                blockInfo: activeBlock
            };
        } catch (error) {
            logger.error(`Failed to check trading blocks: ${error.message}`);
            return { isBlocked: false };
        }
    }

    async getUpcomingHighImpactEvents(symbol, timeframe = '24h') {
        try {
            const endTime = new Date(Date.now() + this.parseTimeframe(timeframe));
            
            const events = await prisma.newsEvent.findMany({
                where: {
                    OR: [
                        { symbol: symbol },
                        { symbol: null },
                    ],
                    timestamp: {
                        gte: new Date(),
                        lte: endTime
                    },
                    importance: {
                        gt: sentimentAnalysis.thresholds.highImpact
                    }
                },
                orderBy: {
                    timestamp: 'asc'
                }
            });

            return events.map(event => ({
                ...event,
                timeUntil: event.timestamp.getTime() - Date.now(),
                blockingDetails: {
                    startTime: new Date(event.timestamp.getTime() - 
                        (highImpactEvents[event.type]?.blockingPeriod || 30) * 60 * 1000),
                    endTime: new Date(event.timestamp.getTime() + 
                        (highImpactEvents[event.type]?.waitPeriod || 30) * 60 * 1000),
                    adjustedRisk: this.calculateEventRiskAdjustments(event)
                }
            }));
        } catch (error) {
            logger.error(`Failed to get upcoming events: ${error.message}`);
            return [];
        }
    }

    private calculateEventRiskAdjustments(event) {
        const eventConfig = highImpactEvents[event.type];
        if (!eventConfig) {
            return {
                positionSizeAdjustment: 0.7,
                stopLossMultiplier: 1.3
            };
        }

        return {
            positionSizeAdjustment: eventConfig.positionSizeAdjustment,
            stopLossMultiplier: eventConfig.stopLossMultiplier
        };
    }

    async monitorUpcomingEvents(symbol) {
        try {
            const events = await this.getUpcomingHighImpactEvents(symbol);
            
            for (const event of events) {
                const timeUntilBlock = event.blockingDetails.startTime.getTime() - Date.now();
                
                if (timeUntilBlock > 0) {
                    setTimeout(() => {
                        this.handleHighImpactEvent(event);
                    }, timeUntilBlock);
                }
            }
        } catch (error) {
            logger.error(`Failed to monitor upcoming events: ${error.message}`);
        }
    }

    async clearExpiredBlocks() {
        try {
            await prisma.tradingBlock.updateMany({
                where: {
                    endTime: {
                        lte: new Date()
                    },
                    isActive: true
                },
                data: {
                    isActive: false
                }
            });
        } catch (error) {
            logger.error(`Failed to clear expired blocks: ${error.message}`);
        }
    }

    private parseTimeframe(timeframe) {
        const unit = timeframe.slice(-1);
        const value = parseInt(timeframe.slice(0, -1));
        
        switch(unit) {
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            case 'm': return value * 60 * 1000;
            default: throw new Error(`Invalid timeframe format: ${timeframe}`);
        }
    }

    // Initialize monitoring for multiple symbols
    async initializeMonitoring(symbols) {
        try {
            for (const symbol of symbols) {
                await this.startMonitoring(symbol);
                await this.monitorUpcomingEvents(symbol);
            }

            // Set up periodic cleanup of expired blocks
            setInterval(() => {
                this.clearExpiredBlocks();
            }, newsProviders.cleanupInterval);

        } catch (error) {
            logger.error(`Failed to initialize news monitoring: ${error.message}`);
            throw error;
        }
    }

    // Cleanup method for proper service shutdown
    async shutdown() {
        try {
            for (const [symbol, interval] of this.monitoringIntervals) {
                clearInterval(interval);
            }
            this.monitoringIntervals.clear();
            this.removeAllListeners();
        } catch (error) {
            logger.error(`Error during news monitor shutdown: ${error.message}`);
        }
    }
}

module.exports = NewsMonitorService;