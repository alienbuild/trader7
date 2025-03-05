const monitor = require('./monitor');
const logger = require('./logger');
const BTCCClient = require('../api/btcc/BTCCClient');
const RiskManager = require('../services/RiskManager');

class ErrorRecovery {
    static btccClient = new BTCCClient();

    static async handleTradeError(error, trade) {
        monitor.trackError(error, { tradeId: trade.id });

        switch (error.code) {
            case 'INSUFFICIENT_MARGIN':
                await this.handleMarginError(trade);
                break;
            case 'ORDER_REJECTED':
                await this.handleRejectedOrder(trade);
                break;
            case 'POSITION_STUCK':
                await this.handleStuckPosition(trade);
                break;
            default:
                logger.error(`Unhandled trade error: ${error.message}`, { trade });
                throw error;
        }
    }

    static async handleMarginError(trade) {
        logger.warn(`Handling margin error for trade ${trade.id}`);
        try {
            // Attempt to reduce position size
            const newSize = await RiskManager.calculateReducedPosition(trade);
            if (newSize) {
                await this.btccClient.updateOrderSize(trade.id, newSize);
                logger.info(`Adjusted position size for trade ${trade.id} to ${newSize}`);
            } else {
                await this.btccClient.cancelOrder(trade.id);
                logger.info(`Cancelled trade ${trade.id} due to margin constraints`);
            }
        } catch (error) {
            logger.error(`Failed to handle margin error: ${error.message}`, { trade });
            throw error;
        }
    }

    static async handleRejectedOrder(trade) {
        logger.warn(`Handling rejected order for trade ${trade.id}`);
        try {
            // Check if rejection was due to price movement
            const currentPrice = await this.btccClient.getMarketPrice(trade.symbol);
            const priceDeviation = Math.abs(currentPrice - trade.entryPrice) / trade.entryPrice;

            if (priceDeviation > 0.01) { // 1% price movement
                await this.btccClient.cancelOrder(trade.id);
                logger.info(`Cancelled trade ${trade.id} due to significant price movement`);
            } else {
                // Retry order with adjusted parameters
                const adjustedPrice = await this.btccClient.calculateAdjustedPrice(trade);
                await this.btccClient.updateOrder(trade.id, { price: adjustedPrice });
                logger.info(`Retried trade ${trade.id} with adjusted price ${adjustedPrice}`);
            }
        } catch (error) {
            logger.error(`Failed to handle rejected order: ${error.message}`, { trade });
            throw error;
        }
    }

    static async handleStuckPosition(trade) {
        logger.warn(`Handling stuck position for trade ${trade.id}`);
        try {
            // First attempt to close position normally
            const closed = await this.btccClient.closePosition(trade.id);
            
            if (!closed) {
                // If normal closure fails, attempt emergency closure
                await this.btccClient.emergencyClosePosition(trade.id, {
                    slippage: 0.05, // Allow 5% slippage for emergency
                    forceMarket: true
                });
            }
            
            logger.info(`Successfully closed stuck position for trade ${trade.id}`);
        } catch (error) {
            logger.error(`Failed to handle stuck position: ${error.message}`, { trade });
            throw error;
        }
    }
}

module.exports = ErrorRecovery;