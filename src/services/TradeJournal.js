const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class TradeJournal {
    static async getTrades(page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [trades, total] = await Promise.all([
            prisma.tradeHistory.findMany({
                skip,
                take: limit,
                orderBy: {
                    tradeTime: 'desc'
                },
                select: {
                    id: true,
                    symbol: true,
                    strategy: true,
                    direction: true,
                    entryPrice: true,
                    exitPrice: true,
                    stopLoss: true,
                    takeProfit: true,
                    positionSize: true,
                    leverage: true,
                    pnl: true,
                    outcome: true,
                    tradeTime: true
                }
            }),
            prisma.tradeHistory.count()
        ]);

        return {
            trades,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async logTrade(trade, analysis) {
        await prisma.tradeLog.create({
            data: {
                tradeId: trade.id,
                strategy: trade.strategy,
                entry: trade.entry,
                exit: trade.exit,
                pnl: trade.pnl,
                vectorAnalysis: analysis.vectors,
                marketStructure: analysis.structure,
                sessionContext: analysis.session,
                screenshots: analysis.screenshots,
                notes: analysis.notes
            }
        });
    }
}

module.exports = TradeJournal;
