const { btccClient } = require("../lib/btcc");
const logger = require("../utils/logger");
const { PrismaClient } = require("@prisma/client");
const RiskManager = require("./RiskManager");
const SessionManager = require("./SessionManager");
const { getLiquidityZones } = require("../utils/liquidityZones");
const { TradeError } = require("../utils/errorHandler");
const { NewsEventService } = require('./NewsEventService');

const prisma = new PrismaClient();

class TradeService {
    constructor() {
        this.newsEventService = new NewsEventService();
        this.sessionManager = new SessionManager();
    }

    static async calculateActualPositionSize(quantity, price, leverage) {
        // Calculate fees impact on position size
        const { totalFee } = await btccClient.calculateFees({ quantity, price, leverage });
        
        // Adjust position size to account for fees
        const adjustedQuantity = quantity - (totalFee / price);
        
        return Math.floor(adjustedQuantity);
    }

    async validateTradeConditions(symbol, strategy) {
        // Check market type and session
        const marketType = this._getMarketType(symbol);
        const sessionStatus = await this.sessionManager.getCurrentSession(marketType);
        
        if (marketType === 'NASDAQ' && !sessionStatus.canTrade) {
            throw new Error(`Trading not allowed during ${sessionStatus.currentSession}`);
        }

        // Check for blocking news/events
        const newsStatus = await this.newsEventService.updateAlertService(marketType);
        
        if (!newsStatus.canTrade) {
            throw new Error('Trading blocked due to high-impact news/events');
        }

        // Adjust risk parameters based on session and news
        const sessionAdjustment = this._getSessionAdjustment(sessionStatus);
        const newsAdjustment = newsStatus.modifiedRiskParams;
        
        return {
            canTrade: true,
            adjustedParameters: {
                positionSize: strategy.positionSize * sessionAdjustment * newsAdjustment.sizeFactor,
                stopLoss: strategy.stopLoss * newsAdjustment.slFactor,
                takeProfit: strategy.takeProfit * newsAdjustment.tpFactor,
                leverage: this._adjustLeverageForSession(strategy.leverage, sessionStatus)
            }
        };
    }

    _getMarketType(symbol) {
        if (symbol.includes('-USD') || symbol.includes('/USD')) {
            return 'CRYPTO';
        }
        return 'NASDAQ';
    }

    _getSessionAdjustment(sessionStatus) {
        switch (sessionStatus.currentSession) {
            case 'PRE_MARKET':
                return 0.5;
            case 'AFTER_HOURS':
                return 0.75;
            default:
                return 1.0;
        }
    }

    _adjustLeverageForSession(leverage, sessionStatus) {
        if (sessionStatus.currentSession !== 'REGULAR') {
            return Math.min(leverage, 2); // Reduce leverage in non-regular sessions
        }
        return leverage;
    }

    async executeTrade(tradeParams) {
        const marketType = this._getMarketType(tradeParams.symbol);
        
        // Validate market conditions
        await this._validateMarketConditions(marketType, tradeParams);

        // Get adjusted parameters based on market type and session
        const adjustedParams = await this._getAdjustedParameters(tradeParams);

        try {
            // Execute the trade with adjusted parameters
            const orderResult = await btccClient.placeOrder({
                ...adjustedParams,
                marketType
            });

            await this._logTradeExecution(orderResult);
            return orderResult;

        } catch (error) {
            logger.error(`Trade execution failed: ${error.message}`);
            throw new TradeError(error.message, 'EXECUTION_ERROR');
        }
    }

    async _validateMarketConditions(marketType, tradeParams) {
        if (marketType === 'NASDAQ') {
            // Check market internals
            const internals = await this._getMarketInternals();
            if (!this._validateMarketInternals(internals, tradeParams.direction)) {
                throw new TradeError('Market internals not favorable', 'MARKET_CONDITIONS');
            }

            // Check for opening/closing periods
            const session = await this.sessionManager.getCurrentSession(marketType);
            if (session.isTransitionPeriod) {
                throw new TradeError('Avoiding market open/close period', 'SESSION_TRANSITION');
            }
        }
    }

    async _getAdjustedParameters(tradeParams) {
        const { symbol, size, direction, leverage } = tradeParams;
        
        // Get liquidity zones for position sizing
        const liquidityZones = await getLiquidityZones(symbol);
        
        // Calculate position size based on liquidity
        const adjustedSize = this._adjustPositionForLiquidity(size, liquidityZones);
        
        // Get current market price
        const currentPrice = await btccClient.getCurrentPrice(symbol);
        
        // Calculate actual position size accounting for fees
        const actualSize = await TradeService.calculateActualPositionSize(
            adjustedSize,
            currentPrice,
            leverage
        );

        return {
            ...tradeParams,
            size: actualSize,
            price: currentPrice,
            timestamp: Date.now()
        };
    }

    _adjustPositionForLiquidity(size, liquidityZones) {
        if (!liquidityZones || !liquidityZones.length) {
            return size;
        }

        const nearestZone = this._findNearestLiquidityZone(liquidityZones);
        
        // Reduce position size if near fake-out prone zones
        if (nearestZone.fakeoutCount > 3) {
            return size * 0.75;
        }
        
        // Increase size if in high liquidity zone
        if (nearestZone.highLiquidity) {
            return size * 1.25;
        }

        return size;
    }

    async _getMarketInternals() {
        try {
            return {
                tick: await btccClient.getMarketData('$TICK.X'),
                add: await btccClient.getMarketData('$ADD.X'),
                trin: await btccClient.getMarketData('$TRIN.X'),
                vix: await btccClient.getMarketData('$VIX.X')
            };
        } catch (error) {
            logger.error(`Failed to fetch market internals: ${error.message}`);
            return null;
        }
    }

    _validateMarketInternals(internals, direction) {
        if (!internals) return true; // Skip validation if data unavailable

        if (direction === 'buy') {
            return (
                internals.tick > 400 &&
                internals.add > 1000 &&
                internals.trin < 1.2 &&
                !this._isVixSpiking(internals.vix)
            );
        } else {
            return (
                internals.tick < -400 &&
                internals.add < -1000 &&
                internals.trin > 1.2 &&
                this._isVixSpiking(internals.vix)
            );
        }
    }

    _isVixSpiking(vixData) {
        return vixData.percentageChange > 5;
    }

    async _findNearestLiquidityZone(liquidityZones) {
        const currentPrice = await btccClient.getMarketPrice();
        
        return liquidityZones.reduce((nearest, zone) => {
            const currentDiff = Math.abs(currentPrice - zone.price);
            const nearestDiff = Math.abs(currentPrice - nearest.price);
            return currentDiff < nearestDiff ? zone : nearest;
        });
    }

    async _logTradeExecution(orderResult) {
        try {
            await prisma.tradeExecution.create({
                data: {
                    orderId: orderResult.orderId,
                    symbol: orderResult.symbol,
                    direction: orderResult.direction,
                    size: orderResult.size,
                    price: orderResult.price,
                    leverage: orderResult.leverage,
                    timestamp: new Date(),
                    status: orderResult.status,
                    marketType: this._getMarketType(orderResult.symbol)
                }
            });
        } catch (error) {
            logger.error(`Failed to log trade execution: ${error.message}`);
            // Don't throw error as this is non-critical
        }
    }

    async modifyActivePosition(positionId, modifications) {
        try {
            // Validate modifications
            await this._validatePositionModification(positionId, modifications);

            // Apply changes
            const result = await btccClient.modifyPosition(positionId, modifications);

            // Log modification
            await prisma.positionModification.create({
                data: {
                    positionId,
                    ...modifications,
                    timestamp: new Date()
                }
            });

            return result;
        } catch (error) {
            logger.error(`Failed to modify position: ${error.message}`);
            throw new TradeError(error.message, 'MODIFICATION_ERROR');
        }
    }

    async _validatePositionModification(positionId, modifications) {
        const position = await prisma.position.findUnique({ 
            where: { id: positionId } 
        });
        
        if (!position) {
            throw new TradeError('Position not found', 'INVALID_POSITION');
        }

        // Validate modification parameters
        if (modifications.stopLoss) {
            await this._validateStopLoss(position, modifications.stopLoss);
        }

        if (modifications.takeProfit) {
            await this._validateTakeProfit(position, modifications.takeProfit);
        }

        if (modifications.size) {
            await this._validatePositionSize(position, modifications.size);
        }
    }

    async _validateStopLoss(position, newStopLoss) {
        const currentPrice = await btccClient.getCurrentPrice(position.symbol);
        const minDistance = currentPrice * 0.01; // 1% minimum distance

        if (position.direction === 'buy' && 
            (newStopLoss > currentPrice || currentPrice - newStopLoss < minDistance)) {
            throw new TradeError('Invalid stop loss placement for long position', 'INVALID_SL');
        }

        if (position.direction === 'sell' && 
            (newStopLoss < currentPrice || newStopLoss - currentPrice < minDistance)) {
            throw new TradeError('Invalid stop loss placement for short position', 'INVALID_SL');
        }
    }

    async _validateTakeProfit(position, newTakeProfit) {
        const currentPrice = await btccClient.getCurrentPrice(position.symbol);
        const minDistance = currentPrice * 0.01; // 1% minimum distance

        if (position.direction === 'buy' && 
            (newTakeProfit < currentPrice || newTakeProfit - currentPrice < minDistance)) {
            throw new TradeError('Invalid take profit placement for long position', 'INVALID_TP');
        }

        if (position.direction === 'sell' && 
            (newTakeProfit > currentPrice || currentPrice - newTakeProfit < minDistance)) {
            throw new TradeError('Invalid take profit placement for short position', 'INVALID_TP');
        }
    }

    async _validatePositionSize(position, newSize) {
        const currentPrice = await btccClient.getCurrentPrice(position.symbol);
        const minSize = position.size * 0.5; // Minimum size is 50% of original position
        const maxSize = position.size * 2; // Maximum size is 200% of original position

        if (newSize < minSize) {
            throw new TradeError('New position size is too small', 'INVALID_SIZE');
        }

        if (newSize > maxSize) {
            throw new TradeError('New position size is too large', 'INVALID_SIZE');
        }
    }

    async closePosition(positionId, closeParams = {}) {
        try {
            const position = await prisma.position.findUnique({
                where: { id: positionId }
            });

            if (!position) {
                throw new TradeError('Position not found', 'INVALID_POSITION');
            }

            const result = await btccClient.closePosition(positionId, closeParams);

            await prisma.positionClose.create({
                data: {
                    positionId,
                    closePrice: result.price,
                    pnl: result.pnl,
                    timestamp: new Date(),
                    reason: closeParams.reason || 'MANUAL_CLOSE'
                }
            });

            return result;
        } catch (error) {
            logger.error(`Failed to close position: ${error.message}`);
            throw new TradeError(error.message, 'CLOSE_POSITION_ERROR');
        }
    }

    async getPositionHistory(filters = {}) {
        try {
            const positions = await prisma.position.findMany({
                where: filters,
                include: {
                    modifications: true,
                    close: true
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });

            return positions.map(position => ({
                ...position,
                metrics: this._calculatePositionMetrics(position)
            }));
        } catch (error) {
            logger.error(`Failed to fetch position history: ${error.message}`);
            throw new TradeError(error.message, 'FETCH_HISTORY_ERROR');
        }
    }

    _calculatePositionMetrics(position) {
        const holdingTime = position.close 
            ? position.close.timestamp - position.timestamp 
            : Date.now() - position.timestamp;

        const roi = position.close 
            ? (position.close.pnl / position.initialMargin) * 100 
            : 0;

        return {
            holdingTimeHours: holdingTime / (1000 * 60 * 60),
            roi,
            modifications: position.modifications.length,
            finalLeverage: position.modifications.length > 0 
                ? position.modifications[position.modifications.length - 1].leverage 
                : position.leverage
        };
    }

    async getTradeStatistics(timeframe = '24h') {
        try {
            const startTime = this._calculateStartTime(timeframe);
            
            const trades = await prisma.tradeExecution.findMany({
                where: {
                    timestamp: {
                        gte: startTime
                    }
                }
            });

            return {
                totalTrades: trades.length,
                volume: trades.reduce((sum, trade) => sum + trade.size * trade.price, 0),
                averageLeverage: trades.reduce((sum, trade) => sum + trade.leverage, 0) / trades.length,
                byMarketType: this._groupTradesByMarketType(trades),
                profitLoss: await this._calculateProfitLoss(trades)
            };
        } catch (error) {
            logger.error(`Failed to calculate trade statistics: ${error.message}`);
            throw new TradeError(error.message, 'STATISTICS_ERROR');
        }
    }

    _calculateStartTime(timeframe) {
        const now = new Date();
        switch (timeframe) {
            case '24h':
                return new Date(now.setHours(now.getHours() - 24));
            case '7d':
                return new Date(now.setDate(now.getDate() - 7));
            case '30d':
                return new Date(now.setDate(now.getDate() - 30));
            default:
                return new Date(now.setHours(now.getHours() - 24));
        }
    }

    _groupTradesByMarketType(trades) {
        return trades.reduce((acc, trade) => {
            const marketType = this._getMarketType(trade.symbol);
            if (!acc[marketType]) {
                acc[marketType] = {
                    count: 0,
                    volume: 0
                };
            }
            acc[marketType].count++;
            acc[marketType].volume += trade.size * trade.price;
            return acc;
        }, {});
    }

    async _calculateProfitLoss(trades) {
        const closedPositions = await prisma.positionClose.findMany({
            where: {
                positionId: {
                    in: trades.map(t => t.orderId)
                }
            }
        });

        const totalProfit = closedPositions.reduce((sum, close) => sum + close.pnl, 0);
        const totalLoss = closedPositions.filter(p => p.pnl < 0).reduce((sum, p) => sum - p.pnl, 0);
        const winRate = closedPositions.filter(p => p.pnl > 0).length / closedPositions.length;

        return {
            totalProfit,
            totalLoss,
            winRate
        };
    }

    async emergencyShutdown(symbol) {
        try {
            // Cancel all pending orders first
            await btccClient.cancelAllOrders(symbol);
            
            // Then close all open positions
            const positions = await btccClient.getPositions(symbol);
            for (const position of positions) {
                await btccClient.emergencyClosePosition(position.orderId, {
                    forceMarket: true
                });
            }

            // Log the emergency action
            await prisma.systemLog.create({
                data: {
                    type: 'EMERGENCY_SHUTDOWN',
                    symbol,
                    timestamp: new Date(),
                    details: `Emergency shutdown executed for ${symbol}`
                }
            });
        } catch (error) {
            logger.error(`Emergency shutdown failed: ${error.message}`);
            throw error;
        }
    }

    async validateOrderExecution(orderId, symbol) {
        const btccClient = new BTCCClient();
        const order = await btccClient.getOrder(orderId, symbol);
        
        if (order.status === 'FILLED') {
            return {
                success: true,
                executionPrice: order.avgPrice,
                filledQuantity: order.executedQty
            };
        }
        
        return {
            success: false,
            status: order.status
        };
    }
}

module.exports = TradeService;
