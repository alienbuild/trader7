const TechnicalAnalysis = require('../utils/TechnicalAnalysis');

class VectorAnalysis {
    static analyzeVectors(signal) {
        if (!signal || !signal.recentCandles || !Array.isArray(signal.recentCandles)) {
            throw new Error('Invalid signal: recentCandles must be an array');
        }

        const vectorAnalysis = TechnicalAnalysis.detectVectorCandle(
            signal.open,
            signal.high,
            signal.low,
            signal.close,
            signal.volume,
            signal.avgVolume
        );

        const marketStructure = TechnicalAnalysis.detectMarketStructure(
            signal.recentCandles.map(c => c.high),
            signal.recentCandles.map(c => c.low),
            signal.recentCandles.map(c => c.close)
        );

        return {
            vector: this.processVectorSignal(vectorAnalysis),
            context: this.analyzeMarketContext(signal, marketStructure),
            deepseekPayload: this.prepareDeepseekPayload(signal, vectorAnalysis, marketStructure)
        };
    }

    static processVectorSignal(vector) {
        return {
            type: this.determineVectorType(vector),
            direction: vector.isClimaxUp || vector.isTrendUp ? 'up' : 'down',
            isClimax: vector.isClimaxUp || vector.isClimaxDown,
            isTrend: vector.isTrendUp || vector.isTrendDown,
            quality: vector.quality,
            strength: vector.strength
        };
    }

    static determineVectorType(vector) {
        if (vector.isClimaxUp) return 'climax_up';
        if (vector.isClimaxDown) return 'climax_down';
        if (vector.isTrendUp) return 'trend_up';
        if (vector.isTrendDown) return 'trend_down';
        return 'neutral';
    }

    static analyzeMarketContext(signal, marketStructure) {
        const { recentCandles, session, technicals } = signal;
        const latestCandle = recentCandles[recentCandles.length - 1];
        
        const marketPhase = TechnicalAnalysis.analyzeMarketPhase(
            technicals.ema_50,
            technicals.ema_200,
            latestCandle.close,
            latestCandle.volume,
            technicals.avgVolume || signal.avgVolume || latestCandle.volume
        );

        return {
            marketStructure: {
                ...marketStructure,
                phase: marketPhase,
                alignment: this.checkTrendAlignment(signal)
            },
            sessionContext: {
                name: session.current,
                isSessionOpen: session.isActive,
                sessionHigh: session.range.high,
                sessionLow: session.range.low,
                sessionPhase: this.determineSessionPhase(session)
            },
            technicals: {
                movingAverages: {
                    ema50: technicals.ema_50,
                    ema200: technicals.ema_200,
                    ema800: technicals.ema_800
                },
                indicators: {
                    rsi: technicals.rsi,
                    adr: technicals.adr
                }
            }
        };
    }

    static checkTrendAlignment(signal) {
        const { technicals } = signal;
        const isUptrend = technicals.ema_50 > technicals.ema_200;
        const vectorUp = signal.vector && signal.vector.direction === 'up';
        
        return {
            aligned: isUptrend === vectorUp,
            trend: isUptrend ? 'uptrend' : 'downtrend',
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

    static prepareDeepseekPayload(signal, vectorAnalysis, marketStructure) {
        if (!signal || !signal.recentCandles || !Array.isArray(signal.recentCandles) || signal.recentCandles.length === 0) {
            throw new Error('Invalid signal: recentCandles must be a non-empty array');
        }

        const latestCandle = signal.recentCandles[signal.recentCandles.length - 1];

        return {
            marketData: {
                vector: this.processVectorSignal(vectorAnalysis),
                structure: marketStructure,
                recentCandles: signal.recentCandles,
                session: {
                    name: signal.session.current,
                    isActive: signal.session.isActive,
                    range: signal.session.range,
                    phase: this.determineSessionPhase(signal.session)
                }
            },
            technicalIndicators: {
                movingAverages: {
                    ema50: signal.technicals.ema_50,
                    ema200: signal.technicals.ema_200,
                    ema800: signal.technicals.ema_800
                },
                momentum: {
                    rsi: signal.technicals.rsi,
                    adr: signal.technicals.adr
                }
            },
            vectorAnalysis: {
                strength: vectorAnalysis.strength,
                quality: vectorAnalysis.quality,
                trendAlignment: this.checkTrendAlignment(signal)
            },
            marketStructure: {
                trend: marketStructure.trend,
                strength: marketStructure.strength,
                phase: TechnicalAnalysis.analyzeMarketPhase(
                    signal.technicals.ema_50,
                    signal.technicals.ema_200,
                    latestCandle.close,
                    latestCandle.volume,
                    signal.technicals.avgVolume || signal.avgVolume || latestCandle.volume
                )
            }
        };
    }
}

module.exports = VectorAnalysis;
