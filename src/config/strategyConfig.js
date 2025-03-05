const strategyConfig = {
    brinks_box: {
        timeframe: '15m',
        defaultLeverage: 50,
        maxLeverage: 75,
        riskPercentage: 2,
        minRiskRewardRatio: 2,
        volatilityAdjustment: {
            threshold: 5, // 5% volatility threshold
            reduction: 0.5 // 50% leverage reduction above threshold
        }
    },
    market_cycle: {
        timeframe: '1h',
        defaultLeverage: 20,
        maxLeverage: 30,
        riskPercentage: 1,
        minRiskRewardRatio: 3,
        volatilityAdjustment: {
            threshold: 3,
            reduction: 0.7
        }
    },
    liquidity_sweeps: {
        timeframe: '5m',
        defaultLeverage: 30,
        maxLeverage: 50,
        riskPercentage: 1.5,
        minRiskRewardRatio: 1.5,
        volatilityAdjustment: {
            threshold: 4,
            reduction: 0.6
        }
    }
};

module.exports = strategyConfig;