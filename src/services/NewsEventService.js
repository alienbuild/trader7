const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

class NewsEventService {
    constructor() {
        this.prisma = new PrismaClient();
        this.newsProvider = process.env.NEWS_API_KEY; // Single provider to start with
    }

    async getRelevantNews(symbol, timeframe = '24h') {
        try {
            const news = await this.getNewsFromProvider(symbol);
            await this.storeNewsEvents(news);
            return news;
        } catch (error) {
            logger.error(`Failed to fetch news for ${symbol}: ${error.message}`);
            return [];
        }
    }

    async getUpcomingEvents(symbol) {
        try {
            const events = await this.prisma.economicEvent.findMany({
                where: {
                    symbol,
                    timestamp: {
                        gte: new Date(),
                        lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    }
                },
                orderBy: {
                    timestamp: 'asc'
                }
            });

            return events.map(event => ({
                ...event,
                importance: this.calculateEventImportance(event)
            }));
        } catch (error) {
            logger.error(`Failed to fetch events for ${symbol}: ${error.message}`);
            return [];
        }
    }

    async calculateEventImportance(event) {
        const importanceFactors = {
            'FOMC': 0.9,
            'NFP': 0.9,
            'CPI': 0.8,
            'GDP': 0.8,
            'RETAIL_SALES': 0.7,
            'PMI': 0.6,
            'EARNINGS': 0.7
        };

        return {
            score: importanceFactors[event.type] || 0.5,
            tradingRecommendation: this.getTradingRecommendation(event)
        };
    }

    getTradingRecommendation(event) {
        return {
            shouldTrade: event.importance > 0.7,
            adjustedPositionSize: event.importance > 0.8 ? 0.5 : 1, // Reduce position size for high-impact events
            adjustedStopLoss: event.importance > 0.8 ? 1.5 : 1, // Wider stops for high-impact events
            waitPeriod: event.importance > 0.8 ? 30 : 15 // Minutes to wait after event
        };
    }

    async updateAlertService() {
        // Update AlertService with current news/events status
        const highImpactEvents = await this.getHighImpactEvents();
        return {
            canTrade: !this.hasBlockingEvents(highImpactEvents),
            modifiedRiskParams: this.calculateRiskAdjustments(highImpactEvents)
        };
    }
}

module.exports = NewsEventService;
