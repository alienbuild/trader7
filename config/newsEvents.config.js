module.exports = {
    highImpactEvents: {
        'FOMC': {
            blockingPeriod: 30, // minutes before
            waitPeriod: 30,     // minutes after
            positionSizeAdjustment: 0.5,
            stopLossMultiplier: 1.5,
            affectedMarkets: ['CRYPTO', 'NASDAQ'] // Added markets specification
        },
        'NFP': {
            blockingPeriod: 15,
            waitPeriod: 30,
            positionSizeAdjustment: 0.5,
            stopLossMultiplier: 1.5,
            affectedMarkets: ['CRYPTO', 'NASDAQ']
        },
        'CPI': {
            blockingPeriod: 15,
            waitPeriod: 15,
            positionSizeAdjustment: 0.7,
            stopLossMultiplier: 1.3,
            affectedMarkets: ['CRYPTO', 'NASDAQ']
        }
    },
    newsProviders: {
        bloomberg: {
            priority: 1,
            requiredFields: ['title', 'timestamp', 'impact'],
            refreshInterval: 300000 // 5 minutes
        },
        reuters: {
            priority: 2,
            requiredFields: ['title', 'timestamp', 'impact'],
            refreshInterval: 300000
        },
        tradingEconomics: {
            priority: 3,
            requiredFields: ['event', 'datetime', 'importance'],
            refreshInterval: 900000 // 15 minutes
        }
    },
    sentimentAnalysis: {
        enableAI: true,
        updateInterval: 600000, // 10 minutes
        thresholds: {
            highImpact: 0.7,
            mediumImpact: 0.4,
            lowImpact: 0.2
        }
    },
    marketHours: {
        'NASDAQ': {
            preMarket: {
                start: '04:00',
                end: '09:30',
                timezone: 'America/New_York'
            },
            regular: {
                start: '09:30',
                end: '16:00',
                timezone: 'America/New_York'
            },
            afterHours: {
                start: '16:00',
                end: '20:00',
                timezone: 'America/New_York'
            }
        }
    }
};