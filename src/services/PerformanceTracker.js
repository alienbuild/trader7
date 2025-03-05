class PerformanceTracker {
    static async trackStrategy(strategyName) {
        const metrics = {
            winRate: await this.calculateWinRate(strategyName),
            profitFactor: await this.calculateProfitFactor(strategyName),
            averageRR: await this.calculateAverageRR(strategyName),
            drawdown: await this.calculateDrawdown(strategyName),
            sharpeRatio: await this.calculateSharpeRatio(strategyName)
        };

        // Store metrics in database for historical tracking
        await prisma.strategyMetrics.create({
            data: {
                strategyName,
                metrics,
                timestamp: new Date()
            }
        });

        return metrics;
    }

    static async calculateWinRate(strategyName) {
        const trades = await prisma.tradeHistory.findMany({
            where: {
                strategy: strategyName,
                outcome: { in: ['win', 'loss'] }
            }
        });

        if (!trades.length) return 0;

        const wins = trades.filter(trade => trade.outcome === 'win').length;
        return (wins / trades.length) * 100;
    }

    static async calculateProfitFactor(strategyName) {
        const trades = await prisma.tradeHistory.findMany({
            where: {
                strategy: strategyName,
                pnl: { not: null }
            }
        });

        const profits = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
        const losses = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));

        return losses === 0 ? profits : profits / losses;
    }

    static async calculateAverageRR(strategyName) {
        const trades = await prisma.tradeHistory.findMany({
            where: {
                strategy: strategyName,
                exitPrice: { not: null }
            },
            select: {
                entryPrice: true,
                exitPrice: true,
                stopLoss: true,
                takeProfit: true
            }
        });

        if (!trades.length) return 0;

        const riskRewardRatios = trades.map(trade => {
            const actualProfit = Math.abs(trade.exitPrice - trade.entryPrice);
            const plannedRisk = Math.abs(trade.stopLoss - trade.entryPrice);
            return plannedRisk === 0 ? 0 : actualProfit / plannedRisk;
        });

        return riskRewardRatios.reduce((sum, rr) => sum + rr, 0) / trades.length;
    }

    static async calculateDrawdown(strategyName) {
        const trades = await prisma.tradeHistory.findMany({
            where: {
                strategy: strategyName,
                pnl: { not: null }
            },
            orderBy: { tradeTime: 'asc' }
        });

        let peak = 0;
        let maxDrawdown = 0;
        let runningPnL = 0;

        trades.forEach(trade => {
            runningPnL += trade.pnl;
            if (runningPnL > peak) {
                peak = runningPnL;
            }
            const drawdown = peak - runningPnL;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });

        return maxDrawdown;
    }

    static async calculateSharpeRatio(strategyName) {
        const trades = await prisma.tradeHistory.findMany({
            where: {
                strategy: strategyName,
                pnl: { not: null }
            },
            select: { pnl: true }
        });

        if (trades.length < 2) return 0;

        const returns = trades.map(t => t.pnl);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
        );

        const riskFreeRate = 0.02; // 2% annual risk-free rate
        return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
    }
}

module.exports = PerformanceTracker;