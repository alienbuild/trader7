const fetch = require('node-fetch');

class GrokClient {
    constructor(apiKey, version = 'v2') {
        this.apiKey = apiKey;
        this.baseUrl = `https://api.grok.ai/${version}`;
        this.systemPrompt = `You are a financial market analysis AI. Analyze the provided market data and return structured insights.
Focus on:
1. Market sentiment (bullish/bearish/neutral)
2. Trend strength (0-100)
3. Key price levels
4. Risk factors
5. Relevant market events
6. Social sentiment impact

Return analysis exactly in this JSON format:

{
    "sentiment": "bullish", // or "bearish" or "neutral"
    "sentiment_score": 0.85, // 0 to 1
    "trend_strength": 75, // 0 to 100
    "key_levels": {
        "support": [1925.50, 1920.30],
        "resistance": [1950.20, 1955.40],
        "high_volume_nodes": [1930.25, 1945.75]
    },
    "risk_factors": [
        {
            "factor": "high_volatility",
            "impact": 0.7, // 0 to 1
            "confidence": 0.85 // 0 to 1
        }
    ],
    "market_events": [
        {
            "event": "FOMC Meeting",
            "impact": 0.9,
            "timeframe": "next_4h"
        }
    ],
    "social_sentiment": {
        "score": 0.65,
        "volume": 125000,
        "trending_topics": ["inflation", "rate_hike"]
    },
    "volume_analysis": {
        "current_volume": 15000,
        "avg_volume": 12000,
        "volume_score": 0.8
    },
    "technical_signals": {
        "macd": "bullish",
        "rsi": 65,
        "trend_quality": 0.8
    },
    "overall_confidence": 0.82 // 0 to 1
}

Always maintain this exact structure and data types. Never include additional fields or change the format.`;
    }

    async analyzeSentiment(payload) {
        return {
            sentiment: await this.calculateSentiment({
                vector: payload.vector,
                technicals: payload.technicalIndicators,
                market_context: payload.marketContext,
                news: await this.getRelevantNews(payload.symbol),
                social_metrics: await this.getSocialMetrics(payload.symbol),
                volatility: await this.getVolatilityState(payload.symbol),
                price_action: await this.analyzePriceAction(payload.symbol, payload.timeframe)
            })
        };
    }

    validateGrokResponse(response) {
        const requiredFields = [
            'sentiment',
            'sentiment_score',
            'trend_strength',
            'key_levels',
            'risk_factors',
            'market_events',
            'social_sentiment',
            'volume_analysis',
            'technical_signals',
            'overall_confidence'
        ];

        const missingFields = requiredFields.filter(field => !(field in response));
        if (missingFields.length > 0) {
            throw new Error(`Invalid Grok response. Missing fields: ${missingFields.join(', ')}`);
        }

        if (!['bullish', 'bearish', 'neutral'].includes(response.sentiment)) {
            throw new Error('Invalid sentiment value in Grok response');
        }

        if (response.sentiment_score < 0 || response.sentiment_score > 1) {
            throw new Error('Invalid sentiment score range in Grok response');
        }

        if (response.trend_strength < 0 || response.trend_strength > 100) {
            throw new Error('Invalid trend strength range in Grok response');
        }
    }

    async enrichPayloadData(payload) {
        const { symbol, timeframe } = payload;
        
        // Note: Technical indicators should already be included in the payload
        // from your trading platform or technical analysis service
        
        const [newsData, socialData] = await Promise.all([
            this.getRelevantNews(symbol),
            this.getSocialMetrics(symbol)
        ]);

        return {
            ...payload,
            recent_news: newsData,
            social_metrics: socialData,
            market_context: {
                session: this.getCurrentSession(),
                nearby_events: await this.getUpcomingEvents(symbol)
            }
        };
    }

    async getRelevantNews(symbol) {
        // Fetch recent news and their sentiment impact
        const news = await this.fetchNews(symbol);
        return news.map(item => ({
            title: item.title,
            timestamp: item.timestamp,
            sentiment_impact: item.sentiment,
            relevance_score: item.relevance
        }));
    }

    async getSocialMetrics(symbol) {
        // Analyze social media sentiment and volume
        return {
            twitter_sentiment: await this.getTwitterMetrics(symbol),
            reddit_sentiment: await this.getRedditMetrics(symbol),
            trading_forums: await this.getForumMetrics(symbol)
        };
    }

    getCurrentSession() {
        const hour = new Date().getUTCHours();
        if (hour >= 8 && hour < 16) return 'London';
        if (hour >= 13 && hour < 21) return 'New York';
        return 'Asian';
    }

    async getUpcomingEvents(symbol) {
        try {
            const response = await fetch(`${this.baseUrl}/events`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    symbol,
                    timeframe: '24h' // Next 24 hours by default
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch upcoming events: ${response.statusText}`);
            }

            const events = await response.json();
            return events.map(event => ({
                name: event.name,
                timestamp: event.timestamp,
                impact_level: event.impact, // high, medium, low
                type: event.type, // economic, earnings, news, etc.
                expected_volatility: event.volatility || 'medium'
            }));
        } catch (error) {
            console.error(`Error fetching upcoming events: ${error.message}`);
            return []; // Return empty array if fetch fails
        }
    }
}

module.exports = GrokClient;