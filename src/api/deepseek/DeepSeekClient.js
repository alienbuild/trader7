const fetch = require('node-fetch');

class DeepSeekClient {
    static async analyzeSignal(payload) {
        const {
            strategy,
            direction,
            price,
            timeframe,
            symbol,
            ema_50,
            ema_200,
            ema_800,
            volume,
            rsi,
            atr,
            macd,
            market_session,
            recent_candles,
            w_formation,
            m_formation,
            balance,
            fees,
            riskStrategy,
        } = payload;

        // Construct the prompt for DeepSeek
        const prompt = `
        Analyze the following trade signal and provide a decision. Incorporate risk management, trading fees, and profitability into your analysis:

        ### Signal Details:
        - **Symbol**: ${symbol}
        - **Direction**: ${direction}
        - **Price**: ${price}
        - **Timeframe**: ${timeframe}
        - **Strategy**: ${strategy}
        - **EMAs**:
          - 50 EMA = ${ema_50}
          - 200 EMA = ${ema_200}
          - 800 EMA = ${ema_800}
        - **RSI**: ${rsi}
        - **ATR**: ${atr}
        - **Volume**: ${volume}
        - **MACD**:
          - Line = ${macd?.line || "N/A"}
          - Signal = ${macd?.signal || "N/A"}
          - Histogram = ${macd?.histogram || "N/A"}
        - **Market Session**: ${market_session}
        - **Recent Candles**: ${JSON.stringify(recent_candles)}
        - **W Formation**: ${JSON.stringify(w_formation || {})}
        - **M Formation**: ${JSON.stringify(m_formation || {})}

        ### Account Details:
        - **Account Balance**: $${balance.toFixed(2)}
        - **Risk Strategy**:
          ${Object.entries(riskStrategy).map(
            ([strength, { riskPercentage, leverageRange }]) =>
                `- ${strength}: Risk ${riskPercentage}% of balance, Leverage ${leverageRange.min}x–${leverageRange.max}x`
        ).join('\n')}
        - **Trading Fees**:
          - Maker Fee: ${fees.makerFee}% 
          - Taker Fee: ${fees.takerFee}%
        - **Preferred Risk-to-Reward Ratio**: Minimum 1:2

        ### Additional Requirements:
        1. Include trading fees (maker/taker) in calculations.
        2. Ensure profitability after fees and leverage.
        3. Suggest optimal leverage, take-profit, and stop-loss levels.
        4. Assess profitability relative to account balance and risk strategy.
        5. Include confidence levels in your analysis.

        ### Expected Output Format:
        {
            "confirmation": "buy",    // or "short" or "no action"
            "leverage": 150,          // suggested leverage
            "takeProfit": 46000.00,   // suggested take-profit price
            "stopLoss": 44000.00,     // suggested stop-loss price
            "riskPercentage": 2,      // percentage of account balance risked
            "contractSize": 100000,   // total contract size
            "confidence": 0.95,       // confidence level (0 to 1)
            "fees": {
            "makerFee": 5,            // in dollars
                "takerFee": 10,       // in dollars
                "totalFee": 15        // total trading fees in dollars
        },
            "expectedProfit": 300,    // net profit after fees in dollars
            "expectedRisk": 50,       // total risk in dollars
            "analysis": {
            "reasoning": "Strong bullish signal with EMA cross and volume spike. Fees and risk-to-reward are favorable.",
                "signalStrength": "high",
                "marketConditions": "bullish"
        }
        }
        `.trim();

        // Send payload and prompt to the DeepSeek API
        const response = await fetch('https://your-deepseek-api-endpoint.com/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payload,
                prompt,
            }),
        });

        if (!response.ok) {
            throw new Error(`DeepSeek API error: ${response.statusText}`);
        }

        return await response.json();
    }
}

module.exports = DeepSeekClient;
