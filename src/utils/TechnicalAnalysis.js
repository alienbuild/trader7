class TechnicalAnalysis {
    static calculateEMA(data, period) {
        const multiplier = 2 / (period + 1);
        let ema = data[0];
        
        for (let i = 1; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }
        
        return ema;
    }

    static calculateATR(highs, lows, closes, period = 14) {
        const trueRanges = [];
        
        for (let i = 1; i < highs.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        return this.calculateEMA(trueRanges, period);
    }

    static detectVectorCandle(open, high, low, close, volume, avgVolume) {
        const bodySize = Math.abs(close - open);
        const upperWick = high - Math.max(open, close);
        const lowerWick = Math.min(open, close) - low;
        const totalRange = high - low;

        return {
            isClimaxUp: volume >= avgVolume * 2 && close > open && lowerWick < bodySize * 0.3,
            isClimaxDown: volume >= avgVolume * 2 && close < open && upperWick < bodySize * 0.3,
            isTrendUp: volume >= avgVolume * 1.5 && close > open && bodySize > totalRange * 0.6,
            isTrendDown: volume >= avgVolume * 1.5 && close < open && bodySize > totalRange * 0.6,
            strength: this.calculateVectorStrength(volume, avgVolume, bodySize, totalRange),
            quality: this.calculateVectorQuality(upperWick, lowerWick, bodySize)
        };
    }

    static calculateVectorStrength(volume, avgVolume, bodySize, totalRange)  {
        const volumeScore = volume / avgVolume;
        const bodySizeScore = bodySize / totalRange;
        return {
            volumeScore,
            bodySizeScore,
            total: (volumeScore + bodySizeScore) / 2
        };
    }

    static calculateVectorQuality(upperWick, lowerWick, bodySize) {
        const wickRatio = (upperWick + lowerWick) / bodySize;
        return {
            wickRatio,
            quality: wickRatio < 0.3 ? 'high' : wickRatio < 0.6 ? 'medium' : 'low',
            score: Math.max(0, 1 - wickRatio)
        };
    }

    static detectMarketStructure(highs, lows, closes, period = 10) {
        const structure = {
            higherHighs: 0,
            higherLows: 0,
            lowerHighs: 0,
            lowerLows: 0
        };

        for (let i = period; i > 1; i--) {
            if (highs[i] > highs[i-1]) structure.higherHighs++;
            if (lows[i] > lows[i-1]) structure.higherLows++;
            if (highs[i] < highs[i-1]) structure.lowerHighs++;
            if (lows[i] < lows[i-1]) structure.lowerLows++;
        }

        return {
            ...structure,
            trend: this.determineStructureTrend(structure),
            strength: this.calculateStructureStrength(structure)
        };
    }

    static determineStructureTrend(structure) {
        const bullishScore = structure.higherHighs + structure.higherLows;
        const bearishScore = structure.lowerHighs + structure.lowerLows;
        
        if (bullishScore > bearishScore * 1.5) return 'strongly_bullish';
        if (bullishScore > bearishScore) return 'bullish';
        if (bearishScore > bullishScore * 1.5) return 'strongly_bearish';
        if (bearishScore > bullishScore) return 'bearish';
        return 'neutral';
    }

    static calculateStructureStrength(structure) {
        const total = structure.higherHighs + structure.higherLows + 
                     structure.lowerHighs + structure.lowerLows;
        
        const strength = {
            higherHighs: structure.higherHighs / total,
            higherLows: structure.higherLows / total,
            lowerHighs: structure.lowerHighs / total,
            lowerLows: structure.lowerLows / total,
            overall: this.calculateOverallStrength(structure, total)
        };
        
        return strength;
    }

    static calculateOverallStrength(structure, total) {
        const bullishScore = (structure.higherHighs + structure.higherLows) / total;
        const bearishScore = (structure.lowerHighs + structure.lowerLows) / total;
        
        return {
            score: Math.abs(bullishScore - bearishScore),
            direction: bullishScore > bearishScore ? 'bullish' : 'bearish',
            magnitude: this.getStrengthMagnitude(Math.abs(bullishScore - bearishScore))
        };
    }

    static getStrengthMagnitude(score) {
        if (score > 0.7) return 'very_strong';
        if (score > 0.5) return 'strong';
        if (score > 0.3) return 'moderate';
        return 'weak';
    }

    static analyzeMarketPhase(ema50, ema200, close, volume, avgVolume) {
        const trendCondition = {
            bullish: close > ema50 && ema50 > ema200,
            bearish: close < ema50 && ema50 < ema200
        };

        const volumeCondition = volume > avgVolume * 1.5;

        if (trendCondition.bullish && volumeCondition) {
            return 'accumulation';
        } else if (trendCondition.bullish && !volumeCondition) {
            return 'markup';
        } else if (trendCondition.bearish && volumeCondition) {
            return 'distribution';
        } else if (trendCondition.bearish && !volumeCondition) {
            return 'markdown';
        }
        
        return 'consolidation';
    }
}

module.exports = TechnicalAnalysis;