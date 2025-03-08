const { prisma } = require('../../lib/prisma');
const { analyzeDailyPerformance } = require('../../utils/tradeAnalytics');

const systemResolvers = {
    Query: {
        getSystemLogs: async (_, { level, category, from, to, limit }, { userId }) => {
            return prisma.systemLog.findMany({
                where: {
                    userId,
                    ...(level && { level }),
                    ...(category && { category }),
                    timestamp: {
                        gte: from,
                        lte: to || new Date()
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                },
                take: limit
            });
        },

        getDailyPerformance: async (_, { from, to }, { userId }) => {
            const trades = await prisma.trade.findMany({
                where: {
                    userId,
                    entryTime: {
                        gte: from,
                        lte: to
                    }
                },
                orderBy: {
                    entryTime: 'asc'
                }
            });

            // Group and analyze trades by day
            return analyzeDailyPerformance(trades);
        }
    }
};

module.exports = systemResolvers;