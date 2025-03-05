const fetch = require('node-fetch');

class DeepSeekClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = process.env.DEEPSEEK_API_URL;
    }

    async analyzeSignal(payload) {
        const response = await fetch(`${this.baseUrl}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'X-API-Version': '1.0'
            },
            body: JSON.stringify({
                market_data: payload.marketData,
                risk_parameters: {
                    max_position_size: process.env.MAX_POSITION_SIZE,
                    default_leverage: process.env.DEFAULT_LEVERAGE,
                    risk_percentage: process.env.RISK_PERCENTAGE,
                    min_risk_reward_ratio: process.env.MIN_RISK_REWARD_RATIO
                },
                technical_indicators: payload.technicalIndicators,
                market_context: payload.marketContext,
                vector_analysis: {
                    type: payload.vector.type,
                    direction: payload.vector.direction,
                    recovered: payload.vector.recovered,
                    // Include any other vector properties from TradingView
                }
            })
        });

        if (!response.ok) {
            throw new Error(`DeepSeek API error: ${response.statusText}`);
        }

        const result = await response.json();
        return this.validateAndFormatResponse(result);
    }

    validateAndFormatResponse(response) {
        const requiredFields = ['sentiment', 'confidence', 'suggested_entry', 'suggested_leverage'];
        
        for (const field of requiredFields) {
            if (!(field in response)) {
                throw new Error(`Invalid DeepSeek response: missing ${field}`);
            }
        }

        return {
            sentiment: response.sentiment,
            confidence: response.confidence,
            suggestedEntry: response.suggested_entry,
            suggestedLeverage: Math.min(
                response.suggested_leverage,
                process.env.MAX_LEVERAGE
            ),
            analysis: response.analysis
        };
    }
}

module.exports = DeepSeekClient;