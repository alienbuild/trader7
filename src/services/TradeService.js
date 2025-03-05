const BtccClient = require("../api/btcc/BTCCClient");
const logger = require("../utils/logger");
const { PrismaClient } = require("@prisma/client");
const RiskManager = require("./RiskManager");
const SessionManager = require("./SessionManager");
const { getLiquidityZones } = require("../utils/liquidityZones");
const {TradeError} = require("../utils/errorHandler");

const prisma = new PrismaClient();
const btccClient = new BtccClient();

class TradeService {
    static async calculateActualPositionSize(quantity, price, leverage) {
        // Calculate fees impact on position size
        const { totalFee } = await btccClient.calculateFees({ quantity, price, leverage });
        
        // Adjust position size to account for fees
        const adjustedQuantity = quantity - (totalFee / price);
        
        return Math.floor(adjustedQuantity);
    }

    static async executeTrade(signal) {
        // Add pre-trade validations
        if (!this.validatePreTradeConditions(signal)) {
            throw new TradeError('Pre-trade conditions not met', 'INVALID_CONDITIONS');
        }

        // Add position sizing check
        const positionSize = await RiskManager.calculatePositionSize(signal);
        if (!positionSize) {
            throw new TradeError('Invalid position size', 'INVALID_POSITION_SIZE');
        }

        // Add duplicate trade check
        if (await this.isDuplicateTrade(signal)) {
            throw new TradeError('Duplicate trade detected', 'DUPLICATE_TRADE');
        }

        // Add session time validation
        const activeSessions = SessionManager.getCurrentSessions();
        if (activeSessions.length === 0) {
            throw new TradeError('Outside trading session hours', 'INVALID_SESSION');
        }

        logger.info(`Executing trade: ${signal.direction.toUpperCase()} ${signal.symbol}, Leverage: ${signal.leverage}x`);

        try {
            // Use WebSocket live price if available, otherwise get market price
            const price = btccClient.latestPrice || await btccClient.getMarketPrice();

            // Check liquidity zones before trade execution
            const liquidityZones = await getLiquidityZones(signal.symbol);
            
            // Validate trade against liquidity zones
            if (signal.direction === "buy" && price > liquidityZones.highLiquidity) {
                throw new Error("Price above major liquidity zone - avoiding chase");
            }
            if (signal.direction === "sell" && price < liquidityZones.lowLiquidity) {
                throw new Error("Price below major liquidity zone - avoiding chase");
            }

            // Analyze order book before trade execution
            const orderBook = await btccClient.getOrderBook(signal.symbol);
            
            // Calculate buy/sell pressure
            const buyPressure = orderBook.bids.reduce((sum, [_, volume]) => sum + volume, 0);
            const sellPressure = orderBook.asks.reduce((sum, [_, volume]) => sum + volume, 0);
            
            // Don't trade against strong market pressure
            if (signal.direction === "buy" && sellPressure > buyPressure * 1.5) {
                throw new Error("High sell pressure detected - avoiding counter-trend trade");
            }
            if (signal.direction === "sell" && buyPressure > sellPressure * 1.5) {
                throw new Error("High buy pressure detected - avoiding counter-trend trade");
            }

            let stopLossDistance, takeProfitDistance;

            // Stop-Loss & Take-Profit Calculation
            if (signal.strategy === "Brinks Box") {
                stopLossDistance = Math.abs(price - (signal.direction === "buy" ? signal.brinks_low : signal.brinks_high));
                takeProfitDistance = stopLossDistance * 2;
            } else {
                stopLossDistance = signal.atr * 1.5;
                takeProfitDistance = stopLossDistance * 2;
            }

            const stopLoss = signal.direction === "buy" ? price - stopLossDistance : price + stopLossDistance;
            const takeProfit = signal.direction === "buy" ? price + takeProfitDistance : price - takeProfitDistance;

            logger.info(`Trade Parameters -> SL: ${stopLoss}, TP: ${takeProfit}, Strategy: ${signal.strategy}`);

            // Pre-trade validation
            const activeSessions = SessionManager.getCurrentSessions();
            if (activeSessions.length === 0) {
                throw new Error("No active trading session");
            }

            // Validate strategy-specific conditions
            if (signal.strategy === "Brinks Box") {
                const brinksTime = SessionManager.getBrinksBoxTiming();
                if (!this.isValidBrinksTime(brinksTime)) {
                    throw new Error("Invalid Brinks Box trading time");
                }
            }

            // Adjust leverage based on volatility
            const adjustedLeverage = RiskManager.adjustLeverageForVolatility(signal.leverage, signal.atr, price);

            // Calculate position size
            const balanceResponse = await btccClient.getBalance();
            const accountBalance = balanceResponse.data?.availableBalance || 0;
            
            if (!accountBalance) {
                throw new TradeError('Unable to fetch available balance', 'BALANCE_ERROR');
            }
            const positionSize = RiskManager.calculatePositionSize(
                accountBalance,
                2, // Assuming 2% risk profile
                Math.abs(price - stopLoss)
            );

            // Adjust position size accounting for fees
            const adjustedPositionSize = await this.calculateActualPositionSize(
                positionSize,
                price,
                adjustedLeverage
            );

            // Execute trade
            const orderResponse = await btccClient.placeOrder({
                symbol: signal.symbol,
                price,
                quantity: adjustedPositionSize,
                side: signal.direction.toLowerCase() === "buy" ? "buy" : "sell",
                leverage: adjustedLeverage,
                type: "market",
            });

            if (orderResponse && orderResponse.success) {
                logger.info(` Trade executed successfully: ${JSON.stringify(orderResponse)}`);

                // Log trade in database for AI training
                await this.logTrade({
                    symbol: signal.symbol,
                    strategy: signal.strategy,
                    direction: signal.direction,
                    entryPrice: price,
                    stopLoss,
                    takeProfit,
                    positionSize: adjustedPositionSize,
                    leverage: adjustedLeverage,
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
    static async logTrade({ symbol, strategy, direction, entryPrice, stopLoss, takeProfit, positionSize, leverage }) {
        await prisma.tradeHistory.create({
            data: {
                symbol,
                strategy,
                direction,
                entryPrice,
                stopLoss,
                takeProfit,
                positionSize,
                leverage,
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

    static validatePreTradeConditions(signal) {
        // Validate required signal parameters
        if (!signal || !signal.symbol || !signal.direction || !signal.strategy) {
            logger.error('Missing required signal parameters');
            return false;
        }

        // Validate signal direction
        if (!['buy', 'sell'].includes(signal.direction.toLowerCase())) {
            logger.error(`Invalid signal direction: ${signal.direction}`);
            return false;
        }

        // Validate leverage range
        if (signal.leverage < 1 || signal.leverage > 500) {
            logger.error(`Invalid leverage value: ${signal.leverage}`);
            return false;
        }

        // Strategy-specific validations
        if (signal.strategy === "Brinks Box") {
            if (!signal.brinks_high || !signal.brinks_low) {
                logger.error('Missing Brinks Box levels');
                return false;
            }
            if (signal.brinks_high <= signal.brinks_low) {
                logger.error('Invalid Brinks Box levels configuration');
                return false;
            }
        }

        // Validate ATR value if present
        if (signal.atr && signal.atr <= 0) {
            logger.error(`Invalid ATR value: ${signal.atr}`);
            return false;
        }

        return true;
    }

    static async isDuplicateTrade(signal) {
        // Check for duplicate trades within the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const recentTrade = await prisma.tradeHistory.findFirst({
            where: {
                symbol: signal.symbol,
                strategy: signal.strategy,
                direction: signal.direction,
                tradeTime: {
                    gte: oneHourAgo
                }
            }
        });

        return !!recentTrade;
    }

    static isValidBrinksTime(brinksTime) {
        const currentTime = new Date();
        const currentHour = currentTime.getUTCHours();
        const currentMinute = currentTime.getUTCMinutes();
        const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        // Check if current time is within formation period
        if (currentTimeStr >= brinksTime.formationStart && currentTimeStr <= brinksTime.formationEnd) {
            logger.info('Currently in Brinks Box formation period - no trading allowed');
            return false;
        }

        // Check if current time is within validity period
        if (currentTimeStr > brinksTime.validityEnd) {
            logger.info('Brinks Box validity period expired');
            return false;
        }

        return true;
    }
}

module.exports = TradeService;
