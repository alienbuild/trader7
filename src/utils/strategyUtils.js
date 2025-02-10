const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getStrategyRules(strategyName) {
    const strategy = await prisma.strategy.findUnique({
        where: { name: strategyName }
    });

    if (!strategy) {
        throw new Error(`🚨 Strategy "${strategyName}" not found in database.`);
    }

    return {
        entryConditions: strategy.entryConditions,
        exitConditions: strategy.exitConditions,
        alerts: strategy.alerts
    };
}

async function getRecentTrades(symbol, strategy, limit = 10) {
    return await prisma.tradeHistory.findMany({
        where: { symbol, strategy },
        orderBy: { tradeTime: "desc" },
        take: limit
    });
}

module.exports = { getStrategyRules, getRecentTrades };
