const TradeService = require('./TradeService');
const DeepSeekClient = require('../api/deepseek/DeepSeekClient');
const BTCCClient = require('../api/btcc/BTCCClient');

class AlertService {
    static async handleAlert(payload) {
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
        } = payload;

        // Fetch current balance and fees dynamically from BTCC
        const balanceResponse = await BTCCClient.getBalance();
        const { accountBalance, availableBalance } = balanceResponse;
        const feesResponse = await BTCCClient.getFees();
        const { makerFee, takerFee } = feesResponse;

        // Define risk strategy dynamically
        const riskStrategy = {
            conservative: {
                riskPercentage: 1, // 1% of account balance
                leverageRange: { min: 50, max: 100 },
            },
            balanced: {
                riskPercentage: 2, // 2% of account balance
                leverageRange: { min: 100, max: 200 },
            },
            aggressive: {
                riskPercentage: 5, // 5% of account balance
                leverageRange: { min: 200, max: 500 },
            },
        };

        // Construct the prompt
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
- **Account Balance**: $${accountBalance.toFixed(2)}
- **Risk Strategy**:
  ${Object.entries(riskStrategy)
            .map(
                ([strength, { riskPercentage, leverageRange }]) =>
                    `- ${strength.charAt(0).toUpperCase() + strength.slice(1)}: Risk ${riskPercentage}% of balance, Leverage ${leverageRange.min}x–${leverageRange.max}x`
            )
            .join('\n')}
- **Trading Fees**:
  - Maker Fee: ${makerFee}% 
  - Taker Fee: ${takerFee}%
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
        "makerFee": 5,        // in dollars
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

        // Send the structured payload and prompt to DeepSeek
        const deepSeekPayload = {
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
            balance: {
                accountBalance,
                availableBalance,
            },
            fees: {
                makerFee,
                takerFee,
            },
            riskStrategy,
            prompt, // Include the constructed prompt
        };

        const deepSeekResult = await DeepSeekClient.analyzeSignal(deepSeekPayload);

        // Validate the DeepSeek response
        try {
            this.validateDeepSeekResponse(deepSeekResult);
        } catch (error) {
            console.error('Invalid DeepSeek response:', error.message);
            return { message: 'Invalid DeepSeek response', error: error.message };
        }

        // If DeepSeek confirms the strategy, execute the trade
        if (deepSeekResult.confirmation === 'buy' || deepSeekResult.confirmation === 'short') {
            const tradeResult = await TradeService.executeTrade({
                symbol,
                direction: deepSeekResult.confirmation,
                price,
                leverage: deepSeekResult.leverage,
                takeProfit: deepSeekResult.takeProfit,
                stopLoss: deepSeekResult.stopLoss,
            });

            return tradeResult;
        } else {
            return { message: 'Trade not confirmed by DeepSeek' };
        }
    }

    // Validate DeepSeek response format
    static validateDeepSeekResponse(response) {
        if (
            typeof response.confirmation !== 'string' ||
            !['buy', 'short', 'no action'].includes(response.confirmation) ||
            typeof response.leverage !== 'number' ||
            typeof response.takeProfit !== 'number' ||
            typeof response.stopLoss !== 'number' ||
            typeof response.profitability !== 'object' ||
            typeof response.profitability.isProfitable !== 'boolean'
        ) {
            throw new Error('Invalid DeepSeek response format');
        }

        return true;
    }
}

module.exports = AlertService;
