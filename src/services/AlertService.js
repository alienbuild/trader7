const TradeService = require("./TradeService");
const DeepSeekClient = require("../api/deepseek/DeepSeekClient");
const GrokClient = require("../api/grok/GrokClient");
const SessionManager = require("./SessionManager");
const RiskManager = require("./RiskManager");
const TradeJournal = require("./TradeJournal");
const PerformanceTracker = require("./PerformanceTracker");
const SystemHealthCheck = require("../health/systemCheck");
const MarketDataService = require("./MarketDataService");
const logger = require("../utils/logger");
const MarketInternalsService = require('./MarketInternalsService');

class AlertService {
    async processAlert(payload) {
        try {
            const riskManager = new RiskManager();
            
            // Check if trading should be paused
            const pauseCheck = await riskManager.shouldPauseTrading(payload.symbol);
            if (pauseCheck) {
                logger.warn(`Alert ignored - trading is paused for ${payload.symbol}. Reason: ${pauseCheck.reason}`);
                return {
                    success: false,
                    message: `Trading is currently paused: ${pauseCheck.reason}`,
                    conditions: pauseCheck.conditions
                };
            }

            // System health check first
            const healthStatus = await SystemHealthCheck.performHealthCheck();
            if (!this.isSystemHealthy(healthStatus)) {
                throw new Error("System health check failed");
            }

            // Validate market data
            if (!MarketDataService.validateMarketData(payload)) {
                throw new Error("Invalid market data");
            }

            // Session validation
            const sessionStatus = await SessionManager.validateBrinksBoxSession();
            if (!sessionStatus.isValid) {
                throw new Error("Outside valid trading session");
            }

            // Get enriched market data (without recalculating vectors)
            const marketData = await MarketDataService.getEnrichedMarketData(payload);
            
            // Initialize clients
            const grokClient = new GrokClient(process.env.GROK_API_KEY);
            const deepSeekClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY);

            // Get market sentiment from Grok
            const sentimentAnalysis = await grokClient.analyzeSentiment(marketData);
            
            // Get trading signals from DeepSeek using TradingView's vector analysis
            const tradingSignal = await deepSeekClient.analyzeSignal({
                marketData,
                technicalIndicators: marketData.technicalIndicators,
                marketContext: marketData.marketContext,
                vector: payload.vector // Use vector analysis from TradingView
            });

            // Combine analyses
            const analysisResult = {
                sentiment: sentimentAnalysis.sentiment,
                confidence: sentimentAnalysis.confidence, // Changed from overall_confidence to confidence
                shouldTrade: tradingSignal.confidence > process.env.MIN_CONFIDENCE_THRESHOLD,
                suggestedSize: tradingSignal.suggestedSize,
                direction: tradingSignal.sentiment === 'bullish' ? 'long' : 'short'
            };

            if (analysisResult.shouldTrade) {
                // Risk check
                const riskValidation = await RiskManager.validateRisk({
                    symbol: payload.symbol,
                    size: analysisResult.suggestedSize,
                    direction: analysisResult.direction
                });

                if (!riskValidation) {
                    throw new Error("Risk parameters exceeded");
                }

                // Initialize TradeService instance
                const tradeService = new TradeService();
                
                // Execute trade using instance method
                const trade = await tradeService.executeTrade({
                    ...analysisResult,
                    ...payload
                });

                // Log trade
                await TradeJournal.logTrade(trade, {
                    analysis: analysisResult
                });

                // Track performance
                await PerformanceTracker.trackStrategy(payload.strategy, trade);

                return trade;
            }

            return { message: "No trade executed based on analysis" };

        } catch (error) {
            logger.error(`Alert handling error: ${error.message}`);
            throw error;
        }
    }

    static async performCombinedAnalysis(payload, vectorAnalysis) {
        try {
            // Initialize clients
            const deepSeekClient = new DeepSeekClient(process.env.DEEPSEEK_API_KEY);
            
            // Always get DeepSeek analysis
            const deepSeekResult = await deepSeekClient.analyzeSignal({
                ...payload,
                vectorAnalysis
            });

            let grokResult = null;
            try {
                // Attempt to get Grok analysis if available
                const grokClient = new GrokClient(process.env.GROK_API_KEY);
                grokResult = await grokClient.analyzeSentiment({
                    ...payload,
                    vectorAnalysis
                });
            } catch (error) {
                logger.warn(`Grok analysis unavailable: ${error.message}. Proceeding with DeepSeek only.`);
            }

            // If we have both analyses, use combined confidence
            if (grokResult) {
                return {
                    shouldTrade: deepSeekResult.confidence > 0.8 && grokResult.confidence > 0.8,
                    direction: deepSeekResult.direction,
                    suggestedSize: this.calculateSuggestedSize(deepSeekResult, grokResult),
                    confidence: (deepSeekResult.confidence + grokResult.confidence) / 2
                };
            }

            // Fall back to DeepSeek-only analysis
            return {
                shouldTrade: deepSeekResult.confidence > 0.85, // Higher threshold for single source
                direction: deepSeekResult.direction,
                suggestedSize: this.calculateSuggestedSize(deepSeekResult),
                confidence: deepSeekResult.confidence
            };

        } catch (error) {
            logger.error(`Combined analysis error: ${error.message}`);
            throw error;
        }
    }

    static isSystemHealthy(health) {
        return (
            health.database &&
            health.exchange &&
            health.marketData &&
            health.memory.usedPercent < 90 &&
            health.cpu.usagePercent < 80
        );
    }

    static calculateSuggestedSize(deepSeekResult, grokResult = null) {
        // Base size from DeepSeek's analysis
        let baseSize = deepSeekResult.positionSize;

        // Adjustment factors
        const confidenceAdjustment = grokResult 
            ? (deepSeekResult.confidence + grokResult.confidence) / 2 
            : deepSeekResult.confidence;

        const volatilityAdjustment = grokResult 
            ? this.calculateVolatilityAdjustment({
                atr: grokResult.technical_signals.trend_quality * 100,
                price: grokResult.key_levels.support[0]  // Using first support level as reference price
            })
            : this.calculateVolatilityAdjustment({
                atr: deepSeekResult.technical_indicators?.atr || 0,
                price: deepSeekResult.suggestedEntry || deepSeekResult.market_data?.close || 0
            });
        
        const trendStrengthAdjustment = grokResult 
            ? (grokResult.trend_strength || grokResult.technical_signals?.trend_quality * 100) / 100
            : deepSeekResult.trend_strength / 100;
        
        // Risk profile based size adjustment
        const riskAdjustedSize = baseSize * Math.min(
            confidenceAdjustment,
            volatilityAdjustment,
            trendStrengthAdjustment
        );

        // Apply risk limits
        const maxPositionSize = process.env.MAX_POSITION_SIZE || 100000;
        return Math.min(
            Math.floor(riskAdjustedSize),
            maxPositionSize
        );
    }

    static calculateVolatilityAdjustment(marketConditions) {
        const { atr, price } = marketConditions;
        const volatilityRatio = (atr / price) * 100;

        if (volatilityRatio > 5) {
            return 0.5; // High volatility - reduce size by 50%
        } else if (volatilityRatio > 3) {
            return 0.75; // Medium volatility - reduce size by 25%
        }
        return 1; // Normal volatility - no adjustment
    }

    static async validateTradeSignal(payload) {
        try {
            // Get market internals analysis
            const marketInternals = await MarketInternalsService.getMarketInternalsAnalysis();
            
            // Validate market conditions based on direction
            const direction = payload.signal === 'buy' ? 'buy' : 'sell';
            const internalsValid = await MarketInternalsService.validateMarketInternals(direction);

            if (!internalsValid) {
                throw new Error('Market internals validation failed');
            }

            // Adjust position size based on market internals score
            const score = await MarketInternalsService.calculateMarketInternalsScore();
            const positionSizeMultiplier = this._calculatePositionMultiplier(score);

            return {
                isValid: true,
                positionSizeMultiplier,
                marketContext: {
                    internalsScore: score,
                    sentiment: marketInternals.marketSentiment,
                    indicators: marketInternals.indicators
                }
            };

        } catch (error) {
            logger.error(`Trade signal validation failed: ${error.message}`);
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    static _calculatePositionMultiplier(score) {
        // Scale position size based on market internals score
        if (score >= 80) return 1.2;
        if (score >= 60) return 1.0;
        if (score >= 40) return 0.8;
        if (score >= 20) return 0.6;
        return 0.4;
    }
}

module.exports = AlertService;
