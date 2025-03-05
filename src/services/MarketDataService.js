class MarketDataService {
    static async getEnrichedMarketData(payload) {
        return {
            symbol: payload.symbol,
            timeframe: payload.timeframe,
            timestamp: payload.timestamp,
            marketData: {
                recentCandles: payload.recentCandles,
                vector: payload.vector, // Using TradingView's vector analysis
                session: {
                    name: payload.session.current,
                    isActive: payload.session.isActive,
                    range: payload.session.range,
                    phase: this.determineSessionPhase(payload.session)
                }
            },
            technicalIndicators: {
                movingAverages: {
                    ema50: payload.technicals.ema_50,
                    ema200: payload.technicals.ema_200,
                    ema800: payload.technicals.ema_800
                },
                momentum: {
                    rsi: payload.technicals.rsi,
                    adr: payload.technicals.adr
                }
            },
            marketContext: {
                trend: this.determineTrend(payload.technicals),
                session: payload.session
            }
        };
    }

    static validateMarketData(payload) {
        const requiredFields = [
            'symbol',
            'timeframe',
            'timestamp',
            'vector',
            'recentCandles',
            'technicals',
            'session'
        ];

        return requiredFields.every(field => field in payload);
    }

    static determineTrend(technicals) {
        return {
            direction: technicals.ema_50 > technicals.ema_200 ? 'uptrend' : 'downtrend',
            strength: Math.abs(technicals.ema_50 - technicals.ema_200) / technicals.ema_200
        };
    }

    static determineSessionPhase(session) {
        const currentTime = new Date(session.timestamp);
        const sessionStart = new Date(session.startTime);
        const elapsedMinutes = (currentTime - sessionStart) / (1000 * 60);
        
        if (elapsedMinutes < 30) return 'OPENING';
        if (elapsedMinutes > session.duration - 30) return 'CLOSING';
        return 'MIDDLE';
    }
}

module.exports = MarketDataService;