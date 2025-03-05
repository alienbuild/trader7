const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.strategy.createMany({
        data: [
            {
                name: "Brinks Box",
                description: "Trade based on first 15m candle breakout after Brinks Box range.",
                timeframes: ["15m"],
                entryConditions: {
                    confirmation_candle: "First 15-minute candle closes above/below Brinks range",
                    ema_alignment: "50 EMA must align with breakout direction",
                    volume_spike: "Volume increase required"
                },
                exitConditions: {
                    stop_loss: "Set below Brinks Low (for longs) or above Brinks High (for shorts)",
                    take_profit: "1:2 Risk-Reward Ratio"
                },
                riskParameters: {
                    max_risk_per_trade: 2,
                    preferred_leverage: 100,
                    min_risk_reward: 2
                },
                alerts: ["brinks_box_breakout", "brinks_box_retest"],
                isActive: true
            },
            {
                name: "Market Cycle Levels",
                description: "Trade market cycle levels for reversals and continuations",
                timeframes: ["1H"],
                entryConditions: {
                    level_1: "Price creates a new low, forming potential reversal",
                    level_2: "Mid push continuation, trend strengthening",
                    level_3: "Peak formation, possible reversal"
                },
                exitConditions: {
                    stop_loss: "Below/above previous cycle level",
                    take_profit: "Next major market cycle level"
                },
                riskParameters: {
                    max_risk_per_trade: 1.5,
                    preferred_leverage: 50,
                    min_risk_reward: 2.5
                },
                alerts: ["market_cycle_level_1", "market_cycle_level_2", "market_cycle_level_3"],
                isActive: true
            },
            {
                name: "Liquidity Sweeps",
                description: "Detects fakeouts and stop hunts at key levels.",
                timeframes: ["5m", "15m"],
                entryConditions: {
                    fakeout_high: "Price wicks above resistance but closes below",
                    fakeout_low: "Price wicks below support but closes above"
                },
                exitConditions: {
                    stop_loss: "Above/below liquidity zone",
                    take_profit: "Next major support/resistance"
                },
                riskParameters: {
                    max_risk_per_trade: 1.5,
                    preferred_leverage: 75,
                    min_risk_reward: 3
                },
                alerts: ["liquidity_sweep_high", "liquidity_sweep_low"],
                isActive: true
            },
            {
                name: "Vector Candle",
                description: "Trade first vector candles with EMA alignment and volume confirmation",
                timeframes: ["15m", "1h"],
                entryConditions: {
                    green_vector: "First green vector candle above 50 EMA",
                    red_vector: "First red vector candle below 50 EMA",
                    ema_alignment: "EMA fan-out (50 > 200 > 800)",
                    volume_confirmation: "Volume > 2x average"
                },
                exitConditions: {
                    stop_loss: "Below/above previous vector candle",
                    take_profit: "Based on daily ADR"
                },
                riskParameters: {
                    max_risk_per_trade: 1.5,
                    preferred_leverage: 50,
                    min_risk_reward: 2
                },
                alerts: ["green_vector_entry", "red_vector_entry"],
                isActive: true
            },
            {
                name: "W Formation",
                description: "Trade W pattern formations with volume confirmation",
                timeframes: ["15m", "1h"],
                entryConditions: {
                    pattern: "Higher low followed by higher high",
                    volume_confirmation: "Volume spike on breakout",
                    rsi_filter: "RSI < 70",
                    vector_confirmation: "Green vector candle recovered"
                },
                exitConditions: {
                    stop_loss: "Below pattern low",
                    take_profit: "1:2 risk-reward"
                },
                riskParameters: {
                    max_risk_per_trade: 2,
                    preferred_leverage: 75,
                    min_risk_reward: 2
                },
                alerts: ["w_formation_entry"],
                isActive: true
            },
            {
                name: "M Formation",
                description: "Trade M pattern formations with volume confirmation",
                timeframes: ["15m", "1h"],
                entryConditions: {
                    pattern: "Lower high followed by lower low",
                    volume_confirmation: "Volume spike on breakout",
                    rsi_filter: "RSI > 30",
                    vector_confirmation: "Red vector candle recovered"
                },
                exitConditions: {
                    stop_loss: "Above pattern high",
                    take_profit: "1:2 risk-reward"
                },
                riskParameters: {
                    max_risk_per_trade: 2,
                    preferred_leverage: 75,
                    min_risk_reward: 2
                },
                alerts: ["m_formation_entry"],
                isActive: true
            },
            {
                name: "ADR Levels",
                description: "Trade reversals at Average Daily Range levels",
                timeframes: ["1h", "4h"],
                entryConditions: {
                    adr_level: "Price reaches 50% of AMR Low/High",
                    significant_move: "Move > ADR * threshold multiplier",
                    volume_confirmation: "Above average volume"
                },
                exitConditions: {
                    stop_loss: "Based on daily ADR",
                    take_profit: "Next major ADR level"
                },
                riskParameters: {
                    max_risk_per_trade: 1.5,
                    preferred_leverage: 50,
                    min_risk_reward: 2.5
                },
                alerts: ["adr_level_reached"],
                isActive: true
            },
            {
                name: "EMA Cross",
                description: "Trade EMA crossovers with volume confirmation",
                timeframes: ["15m", "1h"],
                entryConditions: {
                    cross_50: "Price crosses 50 EMA",
                    volume_confirmation: "Volume > 1.5x average",
                    trend_alignment: "50 EMA direction matches trade direction",
                    candle_confirmation: "Closing candle in trade direction"
                },
                exitConditions: {
                    stop_loss: "Below/above previous swing low/high",
                    take_profit: "Next major resistance/support"
                },
                riskParameters: {
                    max_risk_per_trade: 1.5,
                    preferred_leverage: 50,
                    min_risk_reward: 2
                },
                alerts: ["ema_cross_long", "ema_cross_short"],
                isActive: true
            },
            {
                name: "Range Breakout",
                description: "Trade breakouts from consolidated ranges",
                timeframes: ["15m", "1h"],
                entryConditions: {
                    consolidation: "Price contained within 5% range for 12+ candles",
                    breakout: "Candle closes outside range with volume",
                    volume_surge: "Volume > 2x average during breakout",
                    trend_alignment: "Breakout direction matches larger timeframe trend"
                },
                exitConditions: {
                    stop_loss: "Below/above consolidation range",
                    take_profit: "1.5x range projection"
                },
                riskParameters: {
                    max_risk_per_trade: 2,
                    preferred_leverage: 75,
                    min_risk_reward: 2
                },
                alerts: ["range_breakout_long", "range_breakout_short"],
                isActive: true
            },
            {
                name: "Volume Profile",
                description: "Trade rejections from high/low volume nodes",
                timeframes: ["1h", "4h"],
                entryConditions: {
                    volume_node: "Price reaches high/low volume node",
                    rejection: "Strong rejection candle from node",
                    volume_confirmation: "Above average volume on rejection",
                    market_structure: "Node aligns with market structure"
                },
                exitConditions: {
                    stop_loss: "Beyond volume node",
                    take_profit: "Next significant volume node"
                },
                riskParameters: {
                    max_risk_per_trade: 1.5,
                    preferred_leverage: 50,
                    min_risk_reward: 2.5
                },
                alerts: ["volume_node_rejection"],
                isActive: true
            },
            {
                name: "Market Structure Break",
                description: "Trade breaks and retests of market structure",
                timeframes: ["1h", "4h"],
                entryConditions: {
                    structure_break: "Break of higher low/lower high",
                    retest: "Price retests broken structure",
                    volume_profile: "Low volume at retest",
                    momentum: "Strong momentum on initial break"
                },
                exitConditions: {
                    stop_loss: "Above/below structure break point",
                    take_profit: "Next major structure level"
                },
                riskParameters: {
                    max_risk_per_trade: 2,
                    preferred_leverage: 75,
                    min_risk_reward: 2
                },
                alerts: ["structure_break_long", "structure_break_short"],
                isActive: true
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
