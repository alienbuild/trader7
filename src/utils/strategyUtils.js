const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getStrategyRules(strategyName) {
    const strategy = await prisma.strategy.findUnique({
        where: { name: strategyName },
        include: {
            entryConditions: true,
            exitConditions: true,
            timeframes: true,
            riskParameters: true
        }
    });

    if (!strategy) {
        throw new Error(`Strategy "${strategyName}" not found in database.`);
    }

    return {
        entryConditions: strategy.entryConditions,
        exitConditions: strategy.exitConditions,
        timeframes: strategy.timeframes,
        riskParameters: strategy.riskParameters,
        alerts: strategy.alerts
    };
}

async function validateStrategyParameters(strategyName, params) {
    const rules = await getStrategyRules(strategyName);
    
    // Validate timeframe
    if (!rules.timeframes.includes(params.timeframe)) {
        throw new Error(`Invalid timeframe for ${strategyName}`);
    }

    // Validate specific strategy parameters
    switch(strategyName) {
        case "Brinks Box":
            if (!params.brinks_high || !params.brinks_low) {
                throw new Error("Brinks Box requires high and low levels");
            }
            break;
        // Add other strategy validations
    }

    return true;
}

module.exports = { 
    getStrategyRules,
    validateStrategyParameters
};
