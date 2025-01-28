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

        // Fetch current balance from BTCC
        const balance = await BTCCClient.getBalance();
        const { accountBalance, availableBalance } = balance;

        // Include fees (these values should be dynamic based on the BTCC API's latest data)
        const fees = {
            makerFee: 0.001, // Example: 0.1%
            takerFee: 0.002, // Example: 0.2%
            withdrawalFee: 0.0005, // Example: 0.0005 BTC
        };

        // Define risk strategy
        const riskStrategy = {
            percentageRisk: 0.01, // Risking 1% of the account balance
            maxLeverage: 10, // Maximum leverage to use
        };

        // Prepare the structured payload for DeepSeek
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
            fees,
            riskStrategy,
        };

        // Send the structured payload to DeepSeek
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
