const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Detects liquidity zones dynamically from recent price action.
 */
async function detectLiquidityZones(symbol, recentCandles) {
    const highLiquidity = Math.max(...recentCandles.map(c => c.high));
    const lowLiquidity = Math.min(...recentCandles.map(c => c.low));

    return { highLiquidity, lowLiquidity };
}

/**
 * Updates the liquidity zones in the database.
 */
async function updateLiquidityZones(symbol, recentCandles) {
    const { highLiquidity, lowLiquidity } = await detectLiquidityZones(symbol, recentCandles);

    // Check if existing liquidity zones need updating
    const existingZone = await prisma.liquidityZone.findFirst({ where: { symbol } });

    if (existingZone) {
        // Update existing liquidity zone
        await prisma.liquidityZone.update({
            where: { id: existingZone.id },
            data: {
                highLiquidity,
                lowLiquidity,
                updatedAt: new Date(),
            }
        });
    } else {
        // Create new liquidity zone
        await prisma.liquidityZone.create({
            data: {
                symbol,
                highLiquidity,
                lowLiquidity,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        });
    }
}

/**
 * Fetches liquidity zones from the database.
 */
async function getLiquidityZones(symbol) {
    return await prisma.liquidityZone.findFirst({ where: { symbol } });
}

module.exports = { updateLiquidityZones, getLiquidityZones };
