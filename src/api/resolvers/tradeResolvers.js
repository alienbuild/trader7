const { prisma } = require('../../lib/prisma');
const {calculateTradingStats, getTimeframeStart, getDayStatus} = require("../../utils/tradeAnalytics");

const tradeResolvers = {
    Query: {
        getActiveTrades: async (_, __, { userId }) => {
            return prisma.trade.findMany({
                where: {
                    userId,
                    status: 'OPEN'
                },
                orderBy: {
                    entryTime: 'desc'
                }
            });
        },

        getTradeHistory: async (_, { from, to, symbol, strategy }, { userId }) => {
            const trades = await prisma.trade.findMany({
                where: {
                    userId,
                    status: 'CLOSED',
                    entryTime: {
                        gte: from,
                        lte: to || new Date()
                    },
                    ...(symbol && { symbol }),
                    ...(strategy && { strategy })
                },
                orderBy: {
                    entryTime: 'desc'
                }
            });

            // Group trades by day and calculate statistics
            const tradesByDay = trades.reduce((acc, trade) => {
                const date = trade.entryTime.toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = {
                        trades: [],
                        totalTrades: 0,
                        winningTrades: 0,
                        losingTrades: 0,
                        netPnl: 0
                    };
                }
                acc[date].trades.push(trade);
                acc[date].totalTrades++;
                if (trade.pnl > 0) acc[date].winningTrades++;
                if (trade.pnl < 0) acc[date].losingTrades++;
                acc[date].netPnl += trade.pnl;
                return acc;
            }, {});

            return Object.entries(tradesByDay).map(([date, data]) => ({
                id: date,
                date: new Date(date),
                ...data,
                winRate: data.totalTrades > 0 ? (data.winningTrades / data.totalTrades) * 100 : 0,
                netPnlPercentage: (data.netPnl / data.trades[0].entryPrice) * 100,
                dayStatus: getDayStatus(data.netPnl)
            }));
        },

        getTradingStats: async (_, { timeframe, from, to }, { userId }) => {
            const trades = await prisma.trade.findMany({
                where: {
                    userId,
                    status: 'CLOSED',
                    entryTime: {
                        gte: from || getTimeframeStart(timeframe),
                        lte: to || new Date()
                    }
                }
            });

            return calculateTradingStats(trades);
        }
    },
    Mutation: {
        async executeTrade(_, { symbol, strategy }, { userId }) {
            const tradeService = new TradeService();
            
            // Validate conditions before executing trade
            await tradeService.validateTradeConditions(symbol, strategy);
            
            // If validation passes, execute the trade
            return tradeService.executeTrade({ symbol, strategy, userId });
        }
    }
};

module.exports = tradeResolvers;