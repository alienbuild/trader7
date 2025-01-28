const BtccClient = require('../api/btcc/BtccClient');
const logger = require('../utils/logger');

class TradeService {
    static async executeTrade({ symbol, direction, price, leverage, takeProfit, stopLoss }) {
        logger.info(`Executing trade: ${direction.toUpperCase()} ${symbol} at price ${price}, leverage: ${leverage}x`);

        try {
            const btccClient = new BtccClient();

            // Place the trade order
            const orderResponse = await btccClient.placeOrder({
                symbol,
                price,
                side: direction.toLowerCase() === 'buy' ? 'buy' : 'sell',
                leverage,
                takeProfit,
                stopLoss,
                type: 'market',
            });

            if (orderResponse && orderResponse.success) {
                logger.info(`Trade executed successfully: ${JSON.stringify(orderResponse)}`);
                return {
                    success: true,
                    tradeDetails: orderResponse,
                };
            } else {
                logger.error(`Failed to execute trade: ${JSON.stringify(orderResponse)}`);
                throw new Error('Trade execution failed');
            }
        } catch (error) {
            logger.error(`Error executing trade: ${error.message}`);
            throw error;
        }
    }
}

module.exports = TradeService;
