const logger = require('../utils/logger');
const config = require('/config/newsEvents.config');
const GrokClient = require('../api/grok/GrokClient');

class NewsAnalysisService {
    constructor() {
        this.grokClient = new GrokClient(process.env.GROK_API_KEY);
    }

    async analyzeSentiment(newsItems) {
        try {
            const enrichedPayload = await this.grokClient.enrichPayloadData({
                news_items: newsItems,
                analysis_type: 'news_sentiment'
            });

            const analysis = await this.grokClient.analyzeSignal(enrichedPayload);
            
            // Using the correct response structure from GrokClient
            return {
                sentiment: this._mapSentimentValue(analysis.market_context.sentiment),
                impact: analysis.market_context.strength / 100, // Convert 0-100 to 0-1
                recommendation: analysis.signal_validation.confirmation,
                riskAdjustments: {
                    position_size: analysis.risk_assessment.suggested_size,
                    stop_adjustment: analysis.risk_assessment.stop_adjustment,
                    warning_flags: analysis.risk_assessment.warning_flags
                }
            };
        } catch (error) {
            logger.error(`Failed to analyze news sentiment: ${error.message}`);
            return null;
        }
    }

    async shouldBlockTrading(symbol) {
        const newsEvents = await this.getRecentNewsEvents(symbol);
        const sentiment = await this.analyzeSentiment(newsEvents);

        return {
            shouldBlock: this._evaluateBlockingConditions(sentiment, newsEvents),
            reason: this._getBlockingReason(sentiment, newsEvents),
            adjustedParameters: this.calculateRiskAdjustments(sentiment)
        };
    }

    calculateRiskAdjustments(sentiment) {
        return {
            positionSizeFactor: this._getPositionSizeAdjustment(sentiment),
            stopLossFactor: this._getStopLossAdjustment(sentiment),
            takeProfitFactor: this._getTakeProfitAdjustment(sentiment)
        };
    }

    _mapSentimentValue(sentiment) {
        switch (sentiment) {
            case 'bullish': return 1;
            case 'bearish': return -1;
            case 'neutral': return 0;
            default: return 0;
        }
    }

    _getPositionSizeAdjustment(sentiment) {
        if (Math.abs(sentiment.impact) > config.sentimentAnalysis.thresholds.highImpact) {
            return 0.5; // Reduce position size by 50% for high-impact news
        }
        if (Math.abs(sentiment.impact) > config.sentimentAnalysis.thresholds.mediumImpact) {
            return 0.7; // Reduce position size by 30% for medium-impact news
        }
        return 1; // No adjustment for low-impact news
    }

    _getStopLossAdjustment(sentiment) {
        // Widen stop loss during high impact news
        if (Math.abs(sentiment.impact) > config.sentimentAnalysis.thresholds.highImpact) {
            return 1.5; // Increase stop loss distance by 50% for high-impact news
        }
        if (Math.abs(sentiment.impact) > config.sentimentAnalysis.thresholds.mediumImpact) {
            return 1.25; // Increase stop loss distance by 25% for medium-impact news
        }
        return 1; // No adjustment for low-impact news
    }

    _getTakeProfitAdjustment(sentiment) {
        // Adjust take profit based on market impact and volatility expectations
        if (Math.abs(sentiment.impact) > config.sentimentAnalysis.thresholds.highImpact) {
            return 1.3; // Increase take profit distance by 30% for high-impact news
        }
        if (Math.abs(sentiment.impact) > config.sentimentAnalysis.thresholds.mediumImpact) {
            return 1.15; // Increase take profit distance by 15% for medium-impact news
        }
        return 1; // No adjustment for low-impact news
    }

    async getRecentNewsEvents(symbol, timeframe = '4h') {
        const currentTime = new Date();
        const lookbackTime = new Date(currentTime.getTime() - this.parseTimeframe(timeframe));

        return await prisma.newsEvent.findMany({
            where: {
                OR: [
                    { symbol: symbol },
                    { symbol: null }, // Global market news
                ],
                timestamp: {
                    gte: lookbackTime,
                    lte: currentTime,
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });
    }

    parseTimeframe(timeframe) {
        const unit = timeframe.slice(-1);
        const value = parseInt(timeframe.slice(0, -1));

        switch(unit) {
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            case 'm': return value * 60 * 1000;
            default: throw new Error(`Invalid timeframe format: ${timeframe}`);
        }
    }

    _evaluateBlockingConditions(sentiment, newsEvents) {
        // Check for high-impact scheduled events
        const hasHighImpactEvent = newsEvents.some(event =>
            event.type === 'ECONOMIC_EVENT' &&
            event.importance > config.sentimentAnalysis.thresholds.highImpact
        );

        // Check for extreme sentiment
        const hasExtremeSentiment = Math.abs(sentiment.sentiment) > 0.8;

        // Check for multiple medium-impact events
        const mediumImpactEvents = newsEvents.filter(event =>
            event.importance > config.sentimentAnalysis.thresholds.mediumImpact
        );

        return hasHighImpactEvent || hasExtremeSentiment || mediumImpactEvents.length >= 3;
    }

    _getBlockingReason(sentiment, newsEvents) {
        if (Math.abs(sentiment.sentiment) > 0.8) {
            return 'Extreme market sentiment detected';
        }

        const highImpactEvent = newsEvents.find(event =>
            event.type === 'ECONOMIC_EVENT' &&
            event.importance > config.sentimentAnalysis.thresholds.highImpact
        );

        if (highImpactEvent) {
            return `High-impact event: ${highImpactEvent.title}`;
        }

        return 'Multiple medium-impact events detected';
    }
}

module.exports = NewsAnalysisService;