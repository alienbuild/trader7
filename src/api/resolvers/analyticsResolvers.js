const TradeService = require('../../services/TradeService');

const analyticsResolvers = {
    Query: {
        async tradeHistory(_, { symbol, startTime, endTime }, { userId }) {
            const btccClient = new BTCCClient();
            const orders = await btccClient.getOrderHistory(
                symbol,
                startTime,
                endTime,
                100
            );

            return orders.map(order => ({
                id: order.orderId,
                symbol: order.symbol,
                side: order.side,
                price: order.price,
                quantity: order.quantity,
                status: order.status,
                timestamp: order.time,
                type: order.type
            }));
        },

        async positionHistory(_, { filters }, { userId }) {
            const tradeService = new TradeService();
            return tradeService.getPositionHistory({
                userId,
                ...filters,
                // Add common filters
                timestamp: {
                    gte: filters.from,
                    lte: filters.to || new Date()
                },
                ...(filters.symbol && { symbol: filters.symbol }),
                ...(filters.strategy && { strategy: filters.strategy })
            });
        },

        async tradeStats(_, { timeframe }, { userId }) {
            const tradeService = new TradeService();
            return tradeService.getTradeStatistics(timeframe);
        },

        async dailyPerformanceReport(_, __, { userId }) {
            const tradeService = new TradeService();
            const stats = await tradeService.getTradeStatistics('24h');

            // Use stats for daily reporting
            return {
                trades: stats.totalTrades,
                volume: stats.volume,
                profitLoss: stats.profitLoss,
                performance: {
                    winRate: stats.profitLoss.winRate,
                    averageLeverage: stats.averageLeverage
                }
            };
        }
    }
};

module.exports = analyticsResolvers;
