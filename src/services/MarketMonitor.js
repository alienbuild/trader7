const logger = require("../utils/logger");
const MarketInternalsService = require('./MarketInternalsService');
const {btccClient} = require("../lib/btcc");

class MarketMonitor {
    static async analyzeMarketConditions(symbol) {
        try {
            // Get market internals analysis
            const marketInternals = await MarketInternalsService.getMarketInternalsAnalysis();
            
            // Get order book data and active orders
            const [orderBook, activeOrders] = await Promise.all([
                btccClient.getOrderBook(symbol),
                btccClient.getActiveOrders(symbol)
            ]);

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
                isSellPressure: orderImbalance < 0.4,
                marketInternals: {
                    score: marketInternals.overallScore,
                    sentiment: marketInternals.marketSentiment,
                    indicators: marketInternals.indicators
                }
            };

        } catch (error) {
            logger.error(`Market condition analysis failed: ${error.message}`);
            throw error;
        }
    }

    static async shouldBlockTrading(symbol) {
        try {
            const marketInternals = await MarketInternalsService.getMarketInternalsAnalysis();
            
            // Block trading if market internals are extremely negative
            if (marketInternals.overallScore < 20) {
                return {
                    shouldBlock: true,
                    reason: 'Extremely negative market internals',
                    duration: 1800000 // 30 minutes
                };
            }

            return {
                shouldBlock: false,
                marketInternalsScore: marketInternals.overallScore
            };

        } catch (error) {
            logger.error(`Trading block check failed: ${error.message}`);
            return { shouldBlock: true, reason: 'Error checking market conditions' };
        }
    }

    static async updateMarketInternalsThresholds() {
        try {
            // Calculate dynamic thresholds based on market volatility
            const history = await MarketInternalsService.getMarketInternalsHistory('1w');
            
            const newThresholds = {
                tick: {
                    long: this._calculateDynamicThreshold(history, 'tick', 0.7),
                    short: this._calculateDynamicThreshold(history, 'tick', 0.3)
                },
                add: {
                    long: this._calculateDynamicThreshold(history, 'add', 0.7),
                    short: this._calculateDynamicThreshold(history, 'add', 0.3)
                },
                trin: {
                    long: this._calculateDynamicThreshold(history, 'trin', 0.3),  // Inverted
                    short: this._calculateDynamicThreshold(history, 'trin', 0.7)  // Inverted
                },
                vix: {
                    long: this._calculateDynamicThreshold(history, 'vix', 0.3),   // Inverted
                    short: this._calculateDynamicThreshold(history, 'vix', 0.7)   // Inverted
                }
            };

            await MarketInternalsService.updateThresholds(newThresholds);
            return true;

        } catch (error) {
            logger.error(`Failed to update market internals thresholds: ${error.message}`);
            return false;
        }
    }

    static _calculateDynamicThreshold(history, indicator, percentile) {
        const values = history.map(record => record[indicator]).sort((a, b) => a - b);
        const index = Math.floor(values.length * percentile);
        return values[index];
    }

    static calculateMarketDepth(orderBook) {
        if (!orderBook || !Array.isArray(orderBook.bids) || !Array.isArray(orderBook.asks)) {
            logger.error('Invalid order book structure');
            return 0;
        }

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