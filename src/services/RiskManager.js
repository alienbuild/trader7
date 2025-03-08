const strategyConfig = require('../config/strategyConfig');
const {sendSlackAlert} = require("../utils/slackNotifier");
const {btccClient} = require("../lib/btcc");

class RiskManager {
    static getStrategySettings(strategyName) {
        const strategy = strategyName.toLowerCase().replace(/\s+/g, '_');
        const config = strategyConfig[strategy];
        
        if (!config) {
            logger.warn(`No configuration found for strategy: ${strategyName}, using defaults`);
            return strategyConfig.brinks_box; // fallback to default strategy
        }
        
        return config;
    }

    static validateLeverage(leverage, strategyName) {
        const { maxLeverage } = this.getStrategySettings(strategyName);
        return {
            valid: leverage <= maxLeverage,
            message: leverage > maxLeverage ? 
                `Leverage ${leverage}x exceeds maximum ${maxLeverage}x for ${strategyName}` : 
                'Leverage validated'
        };
    }

    static async validateRisk(payload) {
        const validations = await Promise.all([
            this.checkDailyLossLimit(),
            this.validateMarketConditions(payload),
            this.calculatePositionSize(payload),
            this.validateMarginRequirements(payload),
            this.validateRiskRewardRatio(payload),
            this.checkExistingExposure(payload)
        ]);

        const failedValidations = validations.filter(v => !v.valid);
        
        return {
            valid: failedValidations.length === 0,
            messages: failedValidations.map(v => v.message)
        };
    }

    static validateMarketConditions(payload) {
        const { vector, technicals, structure } = payload;
        
        // Using pre-calculated indicators from TradingView
        const conditions = {
            vectorQuality: vector.quality >= 7,
            trendAlignment: structure.trend !== 'choppy',
            volumeConfirmation: payload.volume > payload.technicals.avgVolume,
            rsiValid: this.validateRSI(technicals.rsi, payload.direction)
        };

        return {
            valid: Object.values(conditions).every(Boolean),
            message: `Market conditions: ${JSON.stringify(conditions)}`
        };
    }

    static validateRSI(rsi, direction) {
        return direction === 'long' ? rsi < 70 : rsi > 30;
    }

    static async calculatePositionSize(payload) {
        const accountBalance = await btccClient.getAccountBalance();
        const strategySettings = this.getStrategySettings(payload.strategy);
        const maxPositionSize = accountBalance * (strategySettings.maxPositionSizePercentage / 100);

        // Use ADR from payload for volatility adjustment
        let adjustedSize = maxPositionSize;
        if (payload.technicals.adr) {
            const volatilityAdjustment = Math.min(1, process.env.MAX_ADR / payload.technicals.adr);
            adjustedSize *= volatilityAdjustment;
        }

        // Check existing positions
        const activePositions = await btccClient.getActivePositions(payload.symbol);
        const currentExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0);
        
        const availableSize = Math.max(0, maxPositionSize - currentExposure);
        const finalSize = Math.min(adjustedSize, availableSize);

        return {
            valid: finalSize > 0,
            suggestedSize: finalSize,
            message: `Suggested position size: ${finalSize}`
        };
    }

    static async checkAndManageRisk(symbol) {
        try {
            const activeOrders = await btccClient.getActiveOrders(symbol);
            
            for (const order of activeOrders) {
                // Check if market conditions have changed significantly
                const currentPrice = await btccClient.getMarketPrice();
                const priceChange = Math.abs(currentPrice - order.entryPrice) / order.entryPrice;
                
                // If price moved against us more than 5% before order filled
                if (priceChange > 0.05) {
                    await btccClient.cancelOrder(order.orderId);
                    logger.info(`Cancelled order ${order.orderId} due to adverse price movement`);
                }
            }
        } catch (error) {
            logger.error(`Error in risk management: ${error.message}`);
        }
    }

    static validateStopLoss(payload, entry, stopLoss) {
        // Use market structure from payload for additional validation
        const { structure, direction } = payload;
        const isValidPrice = direction === 'long' ? stopLoss < entry : stopLoss > entry;
        
        // Check if stopLoss respects key levels
        const respectsKeyLevels = structure.keyLevels.every(level => 
            direction === 'long' ? stopLoss > level : stopLoss < level
        );

        return {
            valid: isValidPrice && respectsKeyLevels,
            message: isValidPrice ? 
                'Stop loss placement valid' : 
                'Stop loss must be below entry for longs and above entry for shorts'
        };
    }

    static validateTakeProfit(payload, entry, takeProfit) {
        const { direction } = payload;
        const isValid = direction === 'long' ? takeProfit > entry : takeProfit < entry;
        
        return {
            valid: isValid,
            message: isValid ? 
                'Take profit placement valid' : 
                'Take profit must be above entry for longs and below entry for shorts'
        };
    }

    static async checkDailyLossLimit() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const dailyTrades = await prisma.tradeHistory.findMany({
                where: {
                    tradeTime: { gte: today },
                    pnl: { not: null }
                },
                select: { pnl: true }
            });

            const dailyLoss = dailyTrades.reduce((total, trade) => total + trade.pnl, 0);
            const maxDailyLoss = process.env.MAX_DAILY_LOSS_PERCENTAGE || 3;
            const accountBalance = await btccClient.getAccountBalance();
            const maxLossAmount = -(accountBalance * maxDailyLoss / 100);

            return {
                valid: dailyLoss > maxLossAmount,
                currentLoss: dailyLoss,
                maxLoss: maxLossAmount,
                message: `Daily loss: ${dailyLoss.toFixed(2)} / ${maxLossAmount.toFixed(2)}`
            };
        } catch (error) {
            logger.error(`Error checking daily loss limit: ${error.message}`);
            return { valid: false, message: 'Failed to verify daily loss limit' };
        }
    }

    static async checkMaxPositionSize(trade) {
        try {
            const accountBalance = await btccClient.getAccountBalance();
            const maxPositionSize = accountBalance * (process.env.MAX_POSITION_SIZE_PERCENTAGE || 20) / 100;
            
            // Get all active positions for the symbol
            const activePositions = await btccClient.getActivePositions(trade.symbol);
            const totalExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0) + trade.size;

            return {
                valid: totalExposure <= maxPositionSize,
                message: `Position size ${totalExposure} is ${totalExposure <= maxPositionSize ? 'within' : 'exceeding'} max limit of ${maxPositionSize}`
            };
        } catch (error) {
            logger.error(`Error checking position size: ${error.message}`);
            return { valid: false, message: 'Failed to verify position size' };
        }
    }

    static async checkMarginRequirements(trade) {
        try {
            const { maintenanceMargin, requiredMargin } = await btccClient.calculateMargin({
                symbol: trade.symbol,
                size: trade.size,
                leverage: trade.leverage
            });

            const availableBalance = await btccClient.getAvailableBalance();
            const marginRatio = availableBalance / requiredMargin;
            const minMarginRatio = process.env.MIN_MARGIN_RATIO || 1.5;

            return {
                valid: marginRatio >= minMarginRatio,
                message: `Margin ratio ${marginRatio.toFixed(2)} is ${marginRatio >= minMarginRatio ? 'sufficient' : 'insufficient'} (min: ${minMarginRatio})`
            };
        } catch (error) {
            logger.error(`Error checking margin requirements: ${error.message}`);
            return { valid: false, message: 'Failed to verify margin requirements' };
        }
    }

    static async checkExposurePerPair(symbol) {
        try {
            const activePositions = await btccClient.getActivePositions(symbol);
            const totalExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0);
            
            const accountBalance = await btccClient.getAccountBalance();
            const maxExposurePerPair = accountBalance * (process.env.MAX_PAIR_EXPOSURE_PERCENTAGE || 30) / 100;

            return {
                valid: totalExposure <= maxExposurePerPair,
                message: `Exposure for ${symbol} (${totalExposure}) is ${totalExposure <= maxExposurePerPair ? 'within' : 'exceeding'} limits`
            };
        } catch (error) {
            logger.error(`Error checking pair exposure: ${error.message}`);
            return { valid: false, message: 'Failed to verify pair exposure' };
        }
    }

    static async checkVolatilityConditions(symbol) {
        try {
            const candles = await btccClient.getCandles(symbol, '1h', 24);
            const atr = this.calculateATR(candles);
            const price = candles[candles.length - 1].close;
            
            const volatility = (atr / price) * 100;
            const maxVolatility = process.env.MAX_VOLATILITY_PERCENTAGE || 5;

            return {
                valid: volatility <= maxVolatility,
                message: `Volatility ${volatility.toFixed(2)}% is ${volatility <= maxVolatility ? 'acceptable' : 'too high'}`
            };
        } catch (error) {
            logger.error(`Error checking volatility: ${error.message}`);
            return { valid: false, message: 'Failed to verify volatility conditions' };
        }
    }

    static async checkCorrelatedPairs(symbol) {
        try {
            const correlatedPairs = await this.getCorrelatedPairs(symbol);
            const activePositions = await btccClient.getActivePositions();
            
            let totalCorrelatedExposure = 0;
            for (const position of activePositions) {
                if (correlatedPairs.includes(position.symbol)) {
                    totalCorrelatedExposure += position.size;
                }
            }

            const accountBalance = await btccClient.getAccountBalance();
            const maxCorrelatedExposure = accountBalance * (process.env.MAX_CORRELATED_EXPOSURE_PERCENTAGE || 50) / 100;

            return {
                valid: totalCorrelatedExposure <= maxCorrelatedExposure,
                message: `Correlated exposure (${totalCorrelatedExposure}) is ${totalCorrelatedExposure <= maxCorrelatedExposure ? 'within' : 'exceeding'} limits`
            };
        } catch (error) {
            logger.error(`Error checking correlated pairs: ${error.message}`);
            return { valid: false, message: 'Failed to verify correlated pairs exposure' };
        }
    }

    static async getCorrelatedPairs(symbol) {
        // Define correlation groups based on your trading pairs
        const correlationGroups = {
            'BTC': ['BTCUSDT', 'ETHBTC', 'BTCBUSD'],
            'ETH': ['ETHUSDT', 'ETHBTC', 'ETHBUSD'],
            // Add more correlation groups as needed
        };

        // Find the group that contains our symbol
        for (const [key, pairs] of Object.entries(correlationGroups)) {
            if (pairs.includes(symbol)) {
                return pairs.filter(pair => pair !== symbol);
            }
        }

        return [];
    }

    static async validateAllRiskParameters(payload) {
        const validations = await Promise.all([
            this.checkDailyLossLimit(),
            this.validateBrinksBoxStrategy(payload),
            this.validateLeverage(payload.leverage, payload.strategy),
            this.calculatePositionSize(payload),
            this.validateMarginRequirements(payload)
        ]);

        const failedValidations = validations.filter(v => !v.valid);
        
        return {
            valid: failedValidations.length === 0,
            messages: failedValidations.map(v => v.message)
        };
    }

    static async validateTrade(payload) {
        const {
            vector,
            structure,
            session,
            technicals
        } = payload;

        // Use existing data from TradingView
        const validations = [
            this.validateSession(session),
            this.validateVector(vector),
            this.validateMarketStructure(structure),
            await this.checkDailyLossLimit(),
            await this.validatePositionSize(payload)
        ];

        return {
            valid: validations.every(v => v.valid),
            messages: validations.map(v => v.message)
        };
    }

    static validateSession(session) {
        return {
            valid: session.isActive,
            message: session.isActive ? 
                `Valid ${session.current} session` : 
                `Invalid session: ${session.current}`
        };
    }

    static validateVector(vector) {
        return {
            valid: !vector.isRecovered && vector.quality >= 7,
            message: `Vector quality: ${vector.quality}, Recovered: ${vector.isRecovered}`
        };
    }

    static async validatePositionSize(payload) {
        const accountBalance = await btccClient.getAccountBalance();
        const strategySettings = this.getStrategySettings(payload.strategy);
        const maxPositionSize = accountBalance * (strategySettings.maxPositionSizePercentage / 100);
        
        // Use ADR from payload for volatility adjustment
        const volatilityAdjustment = payload.technicals.adr > process.env.MAX_ADR ? 
            process.env.MAX_ADR / payload.technicals.adr : 1;

        const adjustedSize = maxPositionSize * volatilityAdjustment;

        // Get current exposure
        const activePositions = await btccClient.getActivePositions(payload.symbol);
        const currentExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0);
        
        const availableSize = Math.max(0, maxPositionSize - currentExposure);
        const finalSize = Math.min(adjustedSize, availableSize);

        return {
            valid: finalSize > 0,
            suggestedSize: finalSize,
            message: `Suggested position size: ${finalSize}`
        };
    }

    static validateBrinksBoxStrategy(payload) {
        const { session, vector, structure, technicals } = payload;
        
        const conditions = {
            // Session validation
            validSession: ['london', 'newyork'].includes(session.current),
            sessionActive: session.isActive,
            
            // Vector validation
            vectorQuality: vector.quality >= 7,
            vectorType: vector.type !== 'none',
            
            // Market structure validation
            trendDefined: structure.trend !== 'choppy',
            hasKeyLevels: structure.keyLevels.length > 0,
            
            // Technical validation
            emaAlignment: this.validateEmaAlignment(technicals, payload.direction),
            volumeConfirmation: payload.volume > technicals.avgVolume
        };

        return {
            valid: Object.values(conditions).every(Boolean),
            conditions,
            message: `Brinks Box conditions: ${JSON.stringify(conditions)}`
        };
    }

    static validateEmaAlignment(technicals, direction) {
        const { ema_50, ema_200 } = technicals;
        return direction === 'long' ? ema_50 > ema_200 : ema_50 < ema_200;
    }

    static async validateRiskRewardRatio(payload, entry, stopLoss, takeProfit) {
        const { direction } = payload;
        
        const riskPips = Math.abs(entry - stopLoss);
        const rewardPips = Math.abs(entry - takeProfit);
        const ratio = rewardPips / riskPips;

        const minRatio = this.getStrategySettings(payload.strategy).minRiskReward || 2;

        return {
            valid: ratio >= minRatio,
            ratio,
            message: `Risk:Reward ratio ${ratio.toFixed(2)} (min: ${minRatio})`
        };
    }

    static async validateMarginRequirements(payload) {
        try {
            const { maintenanceMargin, requiredMargin } = await btccClient.calculateMargin({
                symbol: payload.symbol,
                size: payload.size,
                leverage: payload.leverage
            });

            const availableBalance = await btccClient.getAvailableBalance();
            const marginRatio = availableBalance / requiredMargin;
            const minMarginRatio = process.env.MIN_MARGIN_RATIO || 1.5;

            return {
                valid: marginRatio >= minMarginRatio,
                message: `Margin ratio ${marginRatio.toFixed(2)} is ${marginRatio >= minMarginRatio ? 'sufficient' : 'insufficient'} (min: ${minMarginRatio})`
            };
        } catch (error) {
            logger.error(`Error checking margin requirements: ${error.message}`);
            return { valid: false, message: 'Failed to verify margin requirements' };
        }
    }

    static async checkExistingExposure(payload) {
        try {
            const activePositions = await btccClient.getActivePositions(payload.symbol);
            const currentExposure = activePositions.reduce((sum, pos) => sum + pos.size, 0);
            
            const accountBalance = await btccClient.getAccountBalance();
            const maxExposurePerPair = accountBalance * (process.env.MAX_PAIR_EXPOSURE_PERCENTAGE || 30) / 100;

            return {
                valid: currentExposure < maxExposurePerPair,
                currentExposure,
                maxExposure: maxExposurePerPair,
                message: `Current exposure: ${currentExposure} / ${maxExposurePerPair}`
            };
        } catch (error) {
            logger.error(`Error checking existing exposure: ${error.message}`);
            return { valid: false, message: 'Failed to verify existing exposure' };
        }
    }

    static validateMarketStructure(payload) {
        const { structure, direction } = payload;
        
        const conditions = {
            trendAlignment: direction === 'long' ? 
                structure.trend === 'uptrend' : 
                structure.trend === 'downtrend',
            keyLevelSupport: this.validateKeyLevels(structure.keyLevels, direction, payload.entry)
        };

        return {
            valid: Object.values(conditions).every(Boolean),
            conditions,
            message: `Market structure validation: ${JSON.stringify(conditions)}`
        };
    }

    static validateKeyLevels(keyLevels, direction, entry) {
        // For longs, we want support below entry
        // For shorts, we want resistance above entry
        return keyLevels.some(level => 
            direction === 'long' ? level < entry : level > entry
        );
    }

    static async monitorActivePositions(symbol) {
        try {
            const positions = await btccClient.getActivePositions(symbol);
            
            for (const position of positions) {
                const currentPrice = await btccClient.getMarketPrice(symbol);
                const unrealizedPnL = position.unrealizedPnL;
                const entryPrice = position.entryPrice;
                const drawdown = (unrealizedPnL / entryPrice) * 100;

                // Check for maximum drawdown breach
                const maxDrawdown = process.env.MAX_POSITION_DRAWDOWN || 5;
                if (Math.abs(drawdown) > maxDrawdown) {
                    logger.warn(`Position ${position.id} exceeded max drawdown: ${drawdown.toFixed(2)}%`);
                    await btccClient.closePosition(position.id);
                    continue;
                }

                // Check for adverse market conditions
                const marketConditions = this.validateMarketConditions({
                    symbol,
                    direction: position.direction,
                    technicals: position.technicals
                });

                if (!marketConditions.valid) {
                    logger.warn(`Closing position ${position.id} due to adverse market conditions`);
                    await btccClient.closePosition(position.id);
                }
            }
        } catch (error) {
            logger.error(`Error monitoring positions: ${error.message}`);
        }
    }

    static async validateTradeExit(payload) {
        const { position, exitReason, currentPrice } = payload;
        
        // Validate exit conditions based on strategy
        const strategySettings = this.getStrategySettings(position.strategy);
        const minHoldingTime = strategySettings.minHoldingTimeMinutes || 5;
        const holdingTime = (Date.now() - position.entryTime) / (1000 * 60);

        const conditions = {
            minimumHoldingTimeMet: holdingTime >= minHoldingTime,
            profitTargetReached: position.direction === 'long' ? 
                currentPrice >= position.takeProfit : 
                currentPrice <= position.takeProfit,
            stopLossTriggered: position.direction === 'long' ? 
                currentPrice <= position.stopLoss : 
                currentPrice >= position.stopLoss,
            validExitReason: ['tp', 'sl', 'manual', 'system'].includes(exitReason)
        };

        return {
            valid: Object.values(conditions).every(Boolean),
            conditions,
            message: `Exit validation: ${JSON.stringify(conditions)}`
        };
    }

    async checkRiskThresholds(symbol) {
        try {
            const checks = await Promise.all([
                this._isVolatilityTooHigh(symbol),
                this._isDrawdownExcessive(symbol),
                this._isSystemUnstable()
            ]);

            if (checks.some(Boolean)) {
                const tradeService = new TradeService();
                await tradeService.emergencyShutdown(symbol);
                
                await prisma.systemLog.create({
                    data: {
                        type: 'RISK_THRESHOLD_BREACH',
                        symbol,
                        timestamp: new Date(),
                        details: JSON.stringify({
                            highVolatility: checks[0],
                            excessiveDrawdown: checks[1],
                            systemUnstable: checks[2]
                        })
                    }
                });

                // Notify administrators
                await sendSlackAlert({
                    type: 'EMERGENCY_SHUTDOWN',
                    symbol,
                    reason: checks[0] ? 'High Volatility' :
                            checks[1] ? 'Excessive Drawdown' :
                            'System Instability',
                    timestamp: new Date()
                });

                return false;
            }

            return true;
        } catch (error) {
            logger.error(`Error checking risk thresholds: ${error.message}`);
            return false; // Assume risk thresholds are breached on error
        }
    }

    async _isVolatilityTooHigh(symbol) {
        try {
            const candles = await btccClient.getCandles(symbol, '1h', 24);
            const atr = this.calculateATR(candles);
            const price = candles[candles.length - 1].close;
            
            const volatility = (atr / price) * 100;
            const maxVolatility = process.env.MAX_VOLATILITY_PERCENTAGE || 5;

            if (volatility > maxVolatility) {
                logger.warn(`High volatility detected for ${symbol}: ${volatility.toFixed(2)}%`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error checking volatility: ${error.message}`);
            return true; // Fail safe: assume high volatility on error
        }
    }

    async _isDrawdownExcessive(symbol) {
        try {
            const positions = await btccClient.getActivePositions(symbol);
            const accountBalance = await btccClient.getAccountBalance();
            
            // Calculate total unrealized PnL
            const totalDrawdown = positions.reduce((sum, pos) => 
                sum + (pos.unrealizedPnL || 0), 0);
            
            const drawdownPercentage = (totalDrawdown / accountBalance) * 100;
            const maxDrawdown = process.env.MAX_ACCOUNT_DRAWDOWN || 10;

            if (Math.abs(drawdownPercentage) > maxDrawdown) {
                logger.warn(`Excessive drawdown detected: ${drawdownPercentage.toFixed(2)}%`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error checking drawdown: ${error.message}`);
            return true; // Fail safe: assume excessive drawdown on error
        }
    }

    async _isSystemUnstable() {
        try {
            // Check API response times
            const startTime = Date.now();
            await btccClient.getMarketPrice('BTC-USD');
            const latency = Date.now() - startTime;
            
            // Check error rate from recent operations
            const recentErrors = await prisma.systemLog.count({
                where: {
                    type: 'ERROR',
                    timestamp: {
                        gte: new Date(Date.now() - 5 * 60 * 1000) // last 5 minutes
                    }
                }
            });

            // Check order execution success rate
            const recentOrders = await prisma.orderLog.findMany({
                where: {
                    timestamp: {
                        gte: new Date(Date.now() - 15 * 60 * 1000) // last 15 minutes
                    }
                }
            });

            const executionSuccessRate = recentOrders.length > 0 
                ? recentOrders.filter(o => o.status === 'FILLED').length / recentOrders.length 
                : 1;

            const conditions = {
                highLatency: latency > (process.env.MAX_API_LATENCY || 1000),
                errorThreshold: recentErrors > (process.env.MAX_ERROR_COUNT || 5),
                memoryUsage: process.memoryUsage().heapUsed > 
                    (process.env.MAX_MEMORY_USAGE || 512 * 1024 * 1024), // 512MB default
                poorExecutionRate: executionSuccessRate < (process.env.MIN_EXECUTION_RATE || 0.8)
            };

            if (Object.values(conditions).some(Boolean)) {
                logger.warn(`System instability detected: ${JSON.stringify(conditions)}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error checking system stability: ${error.message}`);
            return true; // Fail safe: assume system is unstable on error
        }
    }

    // Helper method to calculate ATR (Average True Range)
    static calculateATR(candles, period = 14) {
        if (candles.length < period) {
            throw new Error('Insufficient data for ATR calculation');
        }

        const trueRanges = candles.map((candle, i) => {
            if (i === 0) return candle.high - candle.low;

            const previousClose = candles[i - 1].close;
            const tr = Math.max(
                candle.high - candle.low,
                Math.abs(candle.high - previousClose),
                Math.abs(candle.low - previousClose)
            );
            return tr;
        });

        // Calculate simple moving average of true ranges
        return trueRanges
            .slice(-period)
            .reduce((sum, tr) => sum + tr, 0) / period;
    }

    // Method to check if trading should be paused
    async shouldPauseTrading(symbol) {
        try {
            // Check market conditions
            const marketData = await MarketDataService.getMarketData(symbol);
            
            const conditions = {
                isVolatile: await this._isVolatilityTooHigh(symbol),
                hasExcessiveDrawdown: await this._isDrawdownExcessive(symbol),
                isSystemUnstable: await this._isSystemUnstable(),
                isMarketClosed: !marketData.isMarketOpen,
                hasRecentNews: await this._hasSignificantNewsEvent(symbol)
            };

            const shouldPause = Object.values(conditions).some(Boolean);

            if (shouldPause) {
                logger.warn(`Trading paused for ${symbol}. Conditions: ${JSON.stringify(conditions)}`);
                
                await prisma.systemLog.create({
                    data: {
                        type: 'TRADING_PAUSE',
                        symbol,
                        timestamp: new Date(),
                        details: JSON.stringify(conditions)
                    }
                });
            }

            return shouldPause;
        } catch (error) {
            logger.error(`Error checking trading pause conditions: ${error.message}`);
            return true; // Fail-safe: pause trading on error
        }
    }

    async _hasSignificantNewsEvent(symbol) {
        try {
            const recentNews = await MarketDataService.getRecentNews(symbol);
            const significantNews = recentNews.filter(news => 
                news.impact === 'HIGH' && 
                (Date.now() - news.timestamp) < 30 * 60 * 1000 // within last 30 minutes
            );

            return significantNews.length > 0;
        } catch (error) {
            logger.error(`Error checking news events: ${error.message}`);
            return true; // Fail-safe: assume significant news on error
        }
    }
}

module.exports = RiskManager;