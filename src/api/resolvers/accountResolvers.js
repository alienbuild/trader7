const BTCCClient = require("../btcc/BtccClient");

const accountResolvers = {
    Query: {
        getAccountBalance: async (_, __, { userId }) => {
            const btccClient = new BTCCClient();
            const balance = await btccClient.getBalance();
            const positions = await btccClient.getPositions();
            
            // Calculate PnL values
            const unrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
            const dailyPnl = positions.reduce((sum, pos) => sum + pos.dailyPnl, 0);
            
            return {
                total: balance.total,
                available: balance.available,
                margin: balance.margin,
                unrealizedPnl,
                realizedPnl: balance.realizedPnl,
                dailyPnl,
                weeklyPnl: balance.weeklyPnl,
                monthlyPnl: balance.monthlyPnl
            };
        }
    }
};

module.exports = accountResolvers;