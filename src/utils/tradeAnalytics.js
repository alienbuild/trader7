const getTimeframeStart = (timeframe) => {
    const now = new Date();
    switch (timeframe) {
        case 'DAY':
            return new Date(now.setHours(0, 0, 0, 0));
        case 'WEEK':
            return new Date(now.setDate(now.getDate() - 7));
        case 'MONTH':
            return new Date(now.setMonth(now.getMonth() - 1));
        case 'YEAR':
            return new Date(now.setFullYear(now.getFullYear() - 1));
        default:
            return new Date(0); // ALL time
    }
};

const getDayStatus = (netPnl) => {
    if (netPnl > 0) return 'WIN';
    if (netPnl < 0) return 'LOSS';
    if (netPnl === 0) return 'NEUTRAL';
    return 'NO_TRADE';
};

const calculateTradingStats = (trades) => {
    if (!trades.length) {
        return {
            winRate: 0,
            profitFactor: 0,
            averageWin: 0,
            averageLoss: 0,
            largestWin: 0,
            largestLoss: 0,
            averageHoldingTime: 0,
            totalTrades: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            currentDrawdown: 0,
            maxDrawdown: 0
        };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    // Calculate basic metrics
    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    // Calculate consecutive wins/losses
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    trades.forEach(trade => {
        if (trade.pnl > 0) {
            currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
            maxWinStreak = Math.max(maxWinStreak, currentStreak);
        } else if (trade.pnl < 0) {
            currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
            maxLossStreak = Math.min(maxLossStreak, currentStreak);
        }
    });

    // Calculate drawdown
    let peak = 0;
    let currentDrawdown = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    trades.forEach(trade => {
        runningPnL += trade.pnl;
        if (runningPnL > peak) {
            peak = runningPnL;
        }
        currentDrawdown = peak - runningPnL;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    });

    return {
        winRate: (winningTrades.length / trades.length) * 100,
        profitFactor: totalLosses === 0 ? totalWins : totalWins / totalLosses,
        averageWin: winningTrades.length ? totalWins / winningTrades.length : 0,
        averageLoss: losingTrades.length ? totalLosses / losingTrades.length : 0,
        largestWin: Math.max(...winningTrades.map(t => t.pnl), 0),
        largestLoss: Math.min(...losingTrades.map(t => t.pnl), 0),
        averageHoldingTime: calculateAverageHoldingTime(trades),
        totalTrades: trades.length,
        consecutiveWins: maxWinStreak,
        consecutiveLosses: Math.abs(maxLossStreak),
        currentDrawdown,
        maxDrawdown
    };
};

const calculateAverageHoldingTime = (trades) => {
    if (!trades.length) return 0;
    
    const holdingTimes = trades.map(trade => {
        const entry = new Date(trade.entryTime);
        const exit = new Date(trade.exitTime);
        return (exit - entry) / (1000 * 60 * 60); // Convert to hours
    });

    return holdingTimes.reduce((sum, time) => sum + time, 0) / trades.length;
};

const analyzeDailyPerformance = (trades) => {
    const dailyStats = {};

    trades.forEach(trade => {
        const date = new Date(trade.entryTime).toISOString().split('T')[0];
        
        if (!dailyStats[date]) {
            dailyStats[date] = {
                date: new Date(date),
                trades: [],
                netPnl: 0,
                volume: 0,
                winningTrades: 0,
                losingTrades: 0,
                largestWin: 0,
                largestLoss: 0
            };
        }

        const day = dailyStats[date];
        day.trades.push(trade);
        day.netPnl += trade.pnl;
        day.volume += Math.abs(trade.quantity * trade.entryPrice);
        
        if (trade.pnl > 0) {
            day.winningTrades++;
            day.largestWin = Math.max(day.largestWin, trade.pnl);
        } else if (trade.pnl < 0) {
            day.losingTrades++;
            day.largestLoss = Math.min(day.largestLoss, trade.pnl);
        }
    });

    // Calculate additional metrics for each day
    return Object.values(dailyStats).map(day => ({
        ...day,
        totalTrades: day.trades.length,
        winRate: day.totalTrades > 0 ? (day.winningTrades / day.totalTrades) * 100 : 0,
        averageTrade: day.totalTrades > 0 ? day.netPnl / day.totalTrades : 0,
        status: getDayStatus(day.netPnl)
    }));
};

const calculateRiskMetrics = (trades) => {
    if (!trades.length) return { sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0 };

    const returns = trades.map(t => t.pnl);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const riskFreeRate = 0.02 / 252; // Daily risk-free rate (2% annual)

    // Calculate standard deviation of returns
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    // Calculate downside deviation (only negative returns)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (negativeReturns.length - 1);
    const downsideDeviation = Math.sqrt(downsideVariance);

    // Calculate maximum drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    trades.forEach(trade => {
        runningPnL += trade.pnl;
        if (runningPnL > peak) {
            peak = runningPnL;
        }
        const drawdown = peak - runningPnL;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    return {
        sharpeRatio: stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev,
        sortinoRatio: downsideDeviation === 0 ? 0 : (avgReturn - riskFreeRate) / downsideDeviation,
        calmarRatio: maxDrawdown === 0 ? 0 : (avgReturn - riskFreeRate) / maxDrawdown
    };
};

const analyzePerformanceByTimeframe = (trades, timeframe) => {
    const startDate = getTimeframeStart(timeframe);
    const periodTrades = trades.filter(t => new Date(t.entryTime) >= startDate);
    
    const stats = calculateTradingStats(periodTrades);
    const riskMetrics = calculateRiskMetrics(periodTrades);
    
    return {
        timeframe,
        trades: periodTrades,
        stats,
        riskMetrics,
        periodStart: startDate,
        periodEnd: new Date()
    };
};

const analyzePerformanceByStrategy = (trades) => {
    const strategyStats = {};

    trades.forEach(trade => {
        if (!strategyStats[trade.strategy]) {
            strategyStats[trade.strategy] = {
                strategy: trade.strategy,
                trades: []
            };
        }
        strategyStats[trade.strategy].trades.push(trade);
    });

    return Object.values(strategyStats).map(strategy => ({
        strategy: strategy.strategy,
        stats: calculateTradingStats(strategy.trades),
        riskMetrics: calculateRiskMetrics(strategy.trades),
        totalTrades: strategy.trades.length
    }));
};

const calculateEquityCurve = (trades) => {
    let equity = 100; // Starting at 100 (percentage basis)
    const equityCurve = [{
        timestamp: trades[0]?.entryTime || new Date(),
        equity
    }];

    trades.forEach(trade => {
        const pnlPercent = (trade.pnl / trade.entryValue) * 100;
        equity *= (1 + pnlPercent / 100);
        equityCurve.push({
            timestamp: trade.exitTime,
            equity
        });
    });

    return equityCurve;
};

const calculateTradeDistribution = (trades) => {
    const distribution = {
        timeOfDay: Array(24).fill(0),
        dayOfWeek: Array(7).fill(0),
        profitRanges: {
            high: 0,    // > 2R
            medium: 0,  // 1-2R
            low: 0,     // 0-1R
            loss: 0     // < 0
        }
    };

    trades.forEach(trade => {
        const entryTime = new Date(trade.entryTime);
        distribution.timeOfDay[entryTime.getHours()]++;
        distribution.dayOfWeek[entryTime.getDay()]++;

        // Calculate R-multiple (assuming trade.riskAmount is available)
        const rMultiple = trade.riskAmount ? trade.pnl / trade.riskAmount : 0;
        
        if (rMultiple > 2) {
            distribution.profitRanges.high++;
        } else if (rMultiple > 1) {
            distribution.profitRanges.medium++;
        } else if (rMultiple > 0) {
            distribution.profitRanges.low++;
        } else {
            distribution.profitRanges.loss++;
        }
    });

    // Calculate percentages
    const totalTrades = trades.length;
    if (totalTrades > 0) {
        distribution.timeOfDay = distribution.timeOfDay.map(count => 
            (count / totalTrades) * 100
        );
        distribution.dayOfWeek = distribution.dayOfWeek.map(count => 
            (count / totalTrades) * 100
        );
        Object.keys(distribution.profitRanges).forEach(range => {
            distribution.profitRanges[range] = 
                (distribution.profitRanges[range] / totalTrades) * 100;
        });
    }

    return distribution;
};

const calculateTradeExpectancy = (trades) => {
    if (!trades.length) return { expectancy: 0, expectancyPerTrade: 0 };

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const winRate = winningTrades.length / trades.length;
    const lossRate = losingTrades.length / trades.length;

    const averageWin = winningTrades.length ? 
        winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
    const averageLoss = losingTrades.length ? 
        Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) / losingTrades.length : 0;

    const expectancy = (winRate * averageWin) - (lossRate * averageLoss);
    const expectancyPerTrade = expectancy / trades.length;

    return {
        expectancy,
        expectancyPerTrade,
        winRate,
        averageWin,
        averageLoss
    };
};

module.exports = {
    getTimeframeStart,
    getDayStatus,
    calculateTradingStats,
    calculateAverageHoldingTime,
    analyzeDailyPerformance,
    calculateRiskMetrics,
    analyzePerformanceByTimeframe,
    analyzePerformanceByStrategy,
    calculateEquityCurve,
    calculateTradeDistribution,
    calculateTradeExpectancy
};
