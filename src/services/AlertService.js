const TradeService = require("./TradeService");
const DeepSeekClient = require("../api/deepseek/DeepSeekClient");
const BTCCClient = require("../api/btcc/BTCCClient");
const { getStrategyRules } = require("../utils/strategyUtils");
const { getMarketSessionTime } = require("../utils/timeUtils");

// Capture live price updates
ws.on("message", (data) => {
    const message = JSON.parse(data);
    if (message.action === "tickinfo" && message.data.length > 0) {
        latestPrice = message.data[0].C;
    }
});

class AlertService {
    static async handleAlert(payload) {
        const {
            strategy,
            direction,
            price,
            timeframe,
            symbol,
            ema_50,
            ema_200,
            ema_800,
            volume,
            rsi,
            atr,
            macd,
            market_session,
            recent_candles,
            w_formation,
            m_formation,
            brinks_high,
            brinks_low
        } = payload;

        // Fetch Market Session Time (Convert to Local)
        const marketSessionTime = await getMarketSessionTime(market_session, "Europe/London");
        console.log(`Market Session: ${marketSessionTime}`);

        // Fetch Strategy Rules
        let strategyRules;
        try {
            strategyRules = await getStrategyRules(strategy);
        } catch (error) {
            console.error(error.message);
            return { message: error.message };
        }

        // Validate Trade Setup Using Strategy Rules
        const meetsEntryConditions = Object.entries(strategyRules.entryConditions || {}).every(([key, condition]) => {
            if (key === "confirmation_candle" && strategy === "Brinks Box") {
                return recent_candles.some(candle =>
                    (brinks_high && candle.close > brinks_high) ||
                    (brinks_low && candle.close < brinks_low)
                );
            }
            if (key === "ema_alignment") {
                return direction === "long" ? ema_50 > ema_200 : ema_50 < ema_200;
            }
            if (key === "volume_spike") {
                return volume > (strategyRules.volume_threshold || 0);
            }
            return true;
        });

        if (!meetsEntryConditions) {
            console.error(`🚨 Trade setup does not meet "${strategy}" entry conditions.`);
            return { message: `Trade setup invalid based on ${strategy} rules.` };
        }

        // Fetch balance & fees dynamically from BTCC
        const balanceResponse = await BTCCClient.getBalance();
        const { accountBalance, availableBalance } = balanceResponse;
        const feesResponse = await BTCCClient.getFees();
        const { makerFee, takerFee } = feesResponse;

        // Define risk strategy dynamically
        const riskStrategy = {
            conservative: { riskPercentage: 1, leverageRange: { min: 50, max: 100 } },
            balanced: { riskPercentage: 2, leverageRange: { min: 100, max: 200 } },
            aggressive: { riskPercentage: 5, leverageRange: { min: 200, max: 500 } },
        };

        const historicalTrades = await getRecentTrades(symbol, strategy, 10);

        const livePrice = latestPrice || payload.price;
        console.log(`📊 Live Price for ${symbol}:`, price);


        // Construct the payload for DeepSeek AI
        const deepSeekPayload = {
            strategy,
            strategyRules,
            direction,
            livePrice,
            timeframe,
            symbol,
            ema_50,
            ema_200,
            ema_800,
            volume,
            rsi,
            atr,
            macd,
            market_session: marketSessionTime, // Market session converted
            recent_candles,
            w_formation,
            m_formation,
            balance: { accountBalance, availableBalance },
            fees: { makerFee, takerFee },
            riskStrategy,
            pastTrades: historicalTrades,
            ...(strategy === "Brinks Box" && { brinks_high, brinks_low }),
        };

        const deepSeekResult = await DeepSeekClient.analyzeSignal(deepSeekPayload);

        // Validate DeepSeek response
        try {
            this.validateDeepSeekResponse(deepSeekResult);
        } catch (error) {
            console.error("🚨 Invalid DeepSeek response:", error.message);
            return { message: "Invalid DeepSeek response", error: error.message };
        }

        // Execute trade if DeepSeek confirms
        if (["buy", "short"].includes(deepSeekResult.confirmation)) {
            return await TradeService.executeTrade({
                strategy,
                symbol,
                direction: deepSeekResult.confirmation,
                livePrice,
                leverage: deepSeekResult.leverage,
                takeProfit: deepSeekResult.takeProfit,
                stopLoss: deepSeekResult.stopLoss,
            });
        } else {
            return { message: "Trade not confirmed by DeepSeek" };
        }
    }

    // Validate DeepSeek response format
    static validateDeepSeekResponse(response) {
        if (
            typeof response.confirmation !== "string" ||
            !["buy", "short", "no action"].includes(response.confirmation) ||
            typeof response.leverage !== "number" ||
            typeof response.takeProfit !== "number" ||
            typeof response.stopLoss !== "number" ||
            typeof response.analysis !== "object"
        ) {
            throw new Error("Invalid DeepSeek response format");
        }
        return true;
    }
}

module.exports = AlertService;
