const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.strategy.createMany({
        data: [
            {
                name: "Brinks Box",
                description: "Trade based on first 15m candle breakout after Brinks Box range.",
                entryConditions: { confirmation_candle: "First 15m candle close above/below range" },
                exitConditions: { stop_loss: "Set at Brinks Low/High", take_profit: "1:2 RR" },
                alerts: ["brinks_box_breakout", "brinks_box_retest"]
            },
            {
                name: "Liquidity Sweeps",
                description: "Detects fakeouts and stop hunts at key levels.",
                entryConditions: { fakeout_high: "Wick above resistance then closes below" },
                exitConditions: { stop_loss: "Above liquidity zone", take_profit: "Below next major support" },
                alerts: ["liquidity_sweep_high", "liquidity_sweep_low"]
            }
        ]
    });

    console.log("Database seeded successfully.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });


// async function detectLiquidityZones(symbol, recentCandles) {
//     // Find price areas where multiple rejections happened
//     const highLiquidity = recentCandles
//         .filter(candle => candle.high === Math.max(...recentCandles.map(c => c.high)))
//         .map(c => c.high);
//
//     const lowLiquidity = recentCandles
//         .filter(candle => candle.low === Math.min(...recentCandles.map(c => c.low)))
//         .map(c => c.low);
//
//     return {
//         highLiquidity: highLiquidity.length ? highLiquidity[0] : null,
//         lowLiquidity: lowLiquidity.length ? lowLiquidity[0] : null
//     };
// }
//
// // Store liquidity zones dynamically
// async function storeLiquidityZones(symbol, recentCandles) {
//     const liquidityData = await detectLiquidityZones(symbol, recentCandles);
//
//     if (liquidityData.highLiquidity && liquidityData.lowLiquidity) {
//         await prisma.liquidityZone.create({
//             data: {
//                 symbol,
//                 highLiquidity: liquidityData.highLiquidity,
//                 lowLiquidity: liquidityData.lowLiquidity,
//                 fakeoutCount: 0
//             }
//         });
//     }
// }
