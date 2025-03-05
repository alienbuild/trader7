const BTCCClient = require("../api/btcc/BTCCClient");
const logger = require("../utils/logger");

class MarketMonitor {
    static async analyzeMarketConditions(symbol) {
        const btccClient = new BTCCClient();
        
        // Get order book data
        const orderBook = await btccClient.getOrderBook(symbol);
        
        // Get active orders
        const activeOrders = await btccClient.getActiveOrders(symbol);
        
        // Calculate market metrics
        const marketDepth = this.calculateMarketDepth(orderBook);
        const orderImbalance = this.calculateOrderImbalance(orderBook);
        const activeOrdersVolume = this.calculateActiveOrdersVolume(activeOrders);
        
        return {
            marketDepth,
            orderImbalance,
            activeOrdersVolume,
            isHighLiquidity: marketDepth > 1000000,
            isBuyPressure: orderImbalance > 0.6,
            isSellPressure: orderImbalance < 0.4
        };
    }

    static calculateMarketDepth(orderBook) {
        // Calculate total volume in order book
        return orderBook.bids.reduce((sum, [_, vol]) => sum + vol, 0) +
               orderBook.asks.reduce((sum, [_, vol]) => sum + vol, 0);
    }

    static calculateOrderImbalance(orderBook) {
        const buyVolume = orderBook.bids.reduce((sum, [_, vol]) => sum + vol, 0);
        const totalVolume = this.calculateMarketDepth(orderBook);
        return buyVolume / totalVolume;
    }

    static calculateActiveOrdersVolume(activeOrders) {
        return activeOrders.reduce((sum, order) => sum + order.quantity, 0);
    }
}

module.exports = MarketMonitor;