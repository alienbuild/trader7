const BtccClient = require("../api/btcc/BTCCClient");
const logger = require("../utils/logger");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const btccClient = new BtccClient();

class TradeService {
    static async executeTrade({ strategy, symbol, direction, leverage, takeProfit, stopLoss, brinks_high, brinks_low, atr }) {
        logger.info(`Executing trade: ${direction.toUpperCase()} ${symbol}, Leverage: ${leverage}x`);

        try {
            // Use WebSocket live price if available, otherwise get market price
            const price = btccClient.latestPrice || await btccClient.getMarketPrice();

            let stopLossDistance, takeProfitDistance;

            // Stop-Loss & Take-Profit Calculation
            if (strategy === "Brinks Box") {
                stopLossDistance = Math.abs(price - (direction === "buy" ? brinks_low : brinks_high));
                takeProfitDistance = stopLossDistance * 2;
            } else {
                stopLossDistance = atr * 1.5;
                takeProfitDistance = stopLossDistance * 2;
            }

            stopLoss = direction === "buy" ? price - stopLossDistance : price + stopLossDistance;
            takeProfit = direction === "buy" ? price + takeProfitDistance : price - takeProfitDistance;

            logger.info(`Trade Parameters -> SL: ${stopLoss}, TP: ${takeProfit}, Strategy: ${strategy}`);

            // Adjust risk-based position size
            const balanceResponse = await btccClient.getBalance();
            const accountBalance = balanceResponse.availableBalance;
            const positionSize = this.calculatePositionSize(accountBalance, 2, stopLossDistance); // Risk 2%

            // Execute trade
            const orderResponse = await btccClient.placeOrder({
                symbol,
                price,
                quantity: positionSize,
                side: direction.toLowerCase() === "buy" ? "buy" : "sell",
                leverage,
                type: "market",
            });

            if (orderResponse && orderResponse.success) {
                logger.info(` Trade executed successfully: ${JSON.stringify(orderResponse)}`);

                // Log trade in database for AI training
                await this.logTrade({
                    symbol,
                    strategy,
                    direction,
                    entryPrice: price,
                    stopLoss,
                    takeProfit,
                    positionSize,
                });

                return { success: true, tradeDetails: orderResponse };
            } else {
                logger.error(`❌ Failed to execute trade: ${JSON.stringify(orderResponse)}`);
                throw new Error("Trade execution failed");
            }

        } catch (error) {
            logger.error(`❌ Error executing trade: ${error.message}`);
            throw error;
        }
    }

    // Log trade for AI training & backtesting
    static async logTrade({ symbol, strategy, direction, entryPrice, stopLoss, takeProfit, positionSize }) {
        await prisma.tradeHistory.create({
            data: {
                symbol,
                strategy,
                direction,
                entryPrice,
                stopLoss,
                takeProfit,
                positionSize,
                tradeTime: new Date(),
                outcome: null,
                pnl: null,
            }
        });
    }

    // Risk-Based Position Sizing
    static calculatePositionSize(accountBalance, riskPercentage, stopLossDistance) {
        const riskAmount = (accountBalance * (riskPercentage / 100));
        return Math.floor(riskAmount / stopLossDistance);
    }
}

module.exports = TradeService;
