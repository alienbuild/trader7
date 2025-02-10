const { PrismaClient } = require("@prisma/client");
const BTCCClient = require("../api/btcc/BTCCClient");
const prisma = new PrismaClient();

// Checks all open trades and updates their outcome (win/loss) & PNL when closed.
async function checkAndUpdateTrades() {
    const openTrades = await prisma.tradeHistory.findMany({
        where: { exitPrice: null }
    });

    for (const trade of openTrades) {
        const tradeStatus = await BTCCClient.getTradeStatus(trade.symbol);

        if (tradeStatus.isClosed) {
            await prisma.tradeHistory.update({
                where: { id: trade.id },
                data: {
                    exitPrice: tradeStatus.exitPrice,
                    pnl: tradeStatus.pnl,
                    outcome: tradeStatus.pnl > 0 ? "win" : "loss"
                }
            });
            console.log(`✅ Trade ${trade.symbol} updated: ${tradeStatus.pnl > 0 ? "Win" : "Loss"}`);
        }
    }
}

// Run every 5 minutes to check trade outcomes
setInterval(checkAndUpdateTrades, 5 * 60 * 1000);
