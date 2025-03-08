const fetch = require('node-fetch');

class GrokClient {
    constructor(apiKey, version = 'v2') {
        this.apiKey = apiKey;
        this.baseUrl = `https://api.grok.ai/${version}`;
        this.systemPrompt = `You are a financial market analysis AI. Analyze the provided market data and trading signals from PineScript.
Focus on validating and enhancing the trading signals with additional market context.

Return analysis exactly in this JSON format:

{
    "signal_validation": {
        "confidence": 0.85, // 0 to 1
        "confirmation": true, // boolean
        "reasoning": "string"
    },
    "market_context": {
        "sentiment": "bullish", // or "bearish" or "neutral"
        "strength": 75, // 0 to 100
        "volatility_state": "high" // "low", "medium", "high"
    },
    "risk_assessment": {
        "suggested_size": 0.7, // 0 to 1
        "stop_adjustment": 0, // in points/pips
        "warning_flags": ["string"]
    },
    "relevant_events": [
        {
            "event": "string",
            "impact": 0.9, // 0 to 1
            "timeframe": "string"
        }
    ]
}`;
    }

    async analyzeSignal(payload) {
        try {
            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    system_prompt: this.systemPrompt,
                    trading_signal: {
                        ...payload.signal,
                        pinescript_data: payload.pineScriptData
                    },
                    market_data: payload.data
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to analyze signal: ${response.statusText}`);
            }

            const result = await response.json();
            this.validateGrokResponse(result);
            return result;
        } catch (error) {
            console.error(`Error analyzing signal: ${error.message}`);
            throw error;
        }
    }

    async analyzeSentiment(marketData) {
        try {
            const response = await fetch(`${this.baseUrl}/analyze/sentiment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-API-Version': '1.0'
                },
                body: JSON.stringify({
                    market_data: marketData,
                    analysis_parameters: {
                        time_frame: marketData.timeframe || '1h',
                        include_technical_signals: true,
                        include_market_context: true
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            return {
                sentiment: data.sentiment,
                confidence: data.confidence,
                technical_signals: data.technical_signals,
                trend_strength: data.trend_strength,
                key_levels: data.key_levels,
                market_context: data.market_context
            };
        } catch (error) {
            logger.error(`Grok sentiment analysis failed: ${error.message}`);
            throw error;
        }
    }

    validateGrokResponse(response) {
        const requiredFields = [
            'signal_validation',
            'market_context',
            'risk_assessment',
            'relevant_events'
        ];

        const missingFields = requiredFields.filter(field => !(field in response));
        if (missingFields.length > 0) {
            throw new Error(`Invalid Grok response. Missing fields: ${missingFields.join(', ')}`);
        }

        if (response.signal_validation.confidence < 0 || response.signal_validation.confidence > 1) {
            throw new Error('Invalid confidence score range in Grok response');
        }

        if (response.market_context.strength < 0 || response.market_context.strength > 100) {
            throw new Error('Invalid trend strength range in Grok response');
        }

        const validSentiments = ['bullish', 'bearish', 'neutral'];
        if (!validSentiments.includes(response.market_context.sentiment)) {
            throw new Error('Invalid sentiment value in Grok response');
        }

        const validVolatilityStates = ['low', 'medium', 'high'];
        if (!validVolatilityStates.includes(response.market_context.volatility_state)) {
            throw new Error('Invalid volatility state in Grok response');
        }
    }

    async enrichPayloadData(payload)  {
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