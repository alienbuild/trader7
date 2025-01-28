const BtccClient = require('../api/btcc/BtccClient');
const logger = require('../utils/logger');

class TradeService {
    static async executeTrade({ symbol, direction, price, leverage, takeProfit, stopLoss }) {
        logger.info(`Executing trade: ${direction} ${symbol} at ${price}`);

        const tradePayload = {
            symbol,
            direction,
            price,
            leverage,
            takeProfit,
            stopLoss,
        };

        // Send trade to BTCC API
        const btccResponse = await BtccClient.createTrade(tradePayload);

        if (btccResponse.success) {
            logger.info(`Trade executed successfully: ${JSON.stringify(btccResponse)}`);
            return btccResponse;
        } else {
            logger.error(`Failed to execute trade: ${JSON.stringify(btccResponse)}`);
            throw new Error('Trade execution failed');
        }
    }
}

module.exports = TradeService;
