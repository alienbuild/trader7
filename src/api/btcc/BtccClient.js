const Bottleneck = require("bottleneck");
const WebSocket = require("ws");
const { sendSlackAlert } = require("../../utils/slackNotifier");

class BTCCClient {
    constructor() {
        // Updated base URLs for production and WebSocket
        this.baseUrl = process.env.BTCC_API_URL || "https://api.btcc.com";
        this.wsUrl = process.env.BTCC_WEBSOCKET_URL || "wss://ws.btcc.com/ws/2";
        this.apiKey = process.env.BTCC_API_KEY;
        this.apiSecret = process.env.BTCC_API_SECRET;
        this.remark = process.env.BTCC_REMARK || "Trader7";

        // Rate limiting as per BTCC docs (10 requests per second)
        this.rateLimiter = new Bottleneck({
            maxConcurrent: 1,
            minTime: 100, // 100ms between requests
        });

        this.ws = null;
        this.latestPrice = null;
        this.heartbeatInterval = null;
        this.connectWebSocket();
    }

    // WebSocket connection handling
    connectWebSocket() {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on("open", () => {
            console.log("Connected to BTCC WebSocket");
            sendSlackAlert("*WebSocket Connected* to BTCC API.");

            // Updated subscription payload
            this.ws.send(JSON.stringify({
                "method": "subscribe",
                "params": {
                    "channel": "ticker",
                    "symbol": "BTC-USD"
                },
                "id": 1
            }));

            this.startHeartbeat();
        });

        this.ws.on("message", (data) => {
            const message = JSON.parse(data);
            if (message.channel === "ticker") {
                this.latestPrice = parseFloat(message.data.last);
            }
        });

        this.ws.on("error", (err) => {
            console.error("❌ WebSocket Error:", err);
            sendSlackAlert(`❌ *WebSocket Error:* ${err.message}`);
        });

        this.ws.on("close", () => {
            console.log("❌ WebSocket Disconnected. Reconnecting...");
            sendSlackAlert("⚠️ *WebSocket Disconnected.* Reconnecting in 5 seconds...");

            clearInterval(this.heartbeatInterval);
            setTimeout(() => this.connectWebSocket(), 5000);
        });
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log("💓 Sending WebSocket Heartbeat...");
                this.ws.send(JSON.stringify({
                    "method": "ping",
                    "id": Date.now()
                }));
            } else {
                console.log("❌ WebSocket is not open. Attempting to reconnect...");
                sendSlackAlert("⚠️ *WebSocket heartbeat failed.* Attempting to reconnect...");
                clearInterval(this.heartbeatInterval);
                this.connectWebSocket();
            }
        }, 15000);
    }

    generateSignature(timestamp, method, endpoint, body = null) {
        const message = timestamp + method + endpoint + (body ? JSON.stringify(body) : '');
        return crypto.createHmac('sha256', this.apiSecret)
            .update(message)
            .digest('hex');
    }

    async sendRequest(endpoint, method, body = null) {
        const timestamp = Date.now().toString();
        const signature = this.generateSignature(timestamp, method, endpoint, body);

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-BTCC-APIKEY': this.apiKey,
            'X-BTCC-SIGNATURE': signature,
            'X-BTCC-TIMESTAMP': timestamp,
            'X-BTCC-REMARK': this.remark
        };

        const options = { method, headers };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await this.rateLimiter.schedule(() => fetch(url, options));

        if (!response.ok) {
            const errorResponse = await response.json();
            throw new Error(`BTCC API Error: ${response.status} - ${JSON.stringify(errorResponse)}`);
        }

        return response.json();
    }

    async placeOrder({ symbol, price, quantity, side, leverage, type = "limit" }) {
        const endpoint = "/v1/order/submit";
        const payload = {
            symbol: symbol,
            side: side.toUpperCase(),
            orderQty: quantity,
            orderPrice: price,
            leverage: leverage,
            orderType: type.toUpperCase(),
            timeInForce: "GTC" // Good Till Cancel
        };

        return this.sendRequest(endpoint, "POST", payload);
    }

    async getMarketPrice(symbol = "BTC-USD") {
        if (this.latestPrice) return this.latestPrice;

        const endpoint = `/v1/market/ticker/${symbol}`;
        const response = await this.sendRequest(endpoint, "GET");
        return parseFloat(response.data.last);
    }

    async getBalance() {
        const endpoint = "/v1/account/wallet";
        return this.sendRequest(endpoint, "GET");
    }

    async getOrderBook(symbol, depth = 10) {
        const endpoint = `/v1/market/depth/${symbol}?size=${depth}`;
        return this.sendRequest(endpoint, "GET");
    }

    async getActiveOrders(symbol) {
        const endpoint = "/v1/order/pending";
        const payload = { symbol };
        return this.sendRequest(endpoint, "GET", payload);
    }

    async getFees() {
        const endpoint = "/v1/account/fee";
        const response = await this.sendRequest(endpoint, "GET");

        return {
            makerFee: parseFloat(response.data.makerFeeRate),
            takerFee: parseFloat(response.data.takerFeeRate),
            withdrawalFee: parseFloat(response.data.withdrawFee || 0)
        };
    }

    async cancelOrder(orderId, symbol) {
        const endpoint = "/v1/order/cancel";
        const payload = {
            orderId,
            symbol
        };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async cancelAllOrders(symbol) {
        const endpoint = "/v1/order/cancel-all";
        const payload = { symbol };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async getOrder(orderId, symbol) {
        const endpoint = "/v1/order/query";
        const payload = {
            orderId,
            symbol
        };
        return this.sendRequest(endpoint, "GET", payload);
    }

    async getOrderHistory(symbol, startTime, endTime, limit = 100) {
        const endpoint = "/v1/order/history";
        const payload = {
            symbol,
            startTime,
            endTime,
            limit
        };
        return this.sendRequest(endpoint, "GET", payload);
    }

    async getPositions(symbol) {
        const endpoint = "/v1/positions";
        const payload = { symbol };
        return this.sendRequest(endpoint, "GET", payload);
    }

    async modifyPosition(symbol, leverage) {
        const endpoint = "/v1/positions/leverage";
        const payload = {
            symbol,
            leverage
        };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async getAccountInfo() {
        const endpoint = "/v1/account/info";
        return this.sendRequest(endpoint, "GET");
    }

    async getTrades(symbol, limit = 100) {
        const endpoint = `/v1/market/trades/${symbol}`;
        const payload = { limit };
        return this.sendRequest(endpoint, "GET", payload);
    }

    async getKlines(symbol, interval = "1m", startTime, endTime, limit = 100) {
        const endpoint = `/v1/market/kline/${symbol}`;
        const payload = {
            interval,
            startTime,
            endTime,
            limit
        };
        return this.sendRequest(endpoint, "GET", payload);
    }

    async calculateFees({ quantity, price, leverage, symbol }) {
        const fees = await this.getFees();

        const tradeValue = quantity * price;
        const leveragedValue = tradeValue * leverage;

        const makerFeeAmount = leveragedValue * fees.makerFee;
        const takerFeeAmount = leveragedValue * fees.takerFee;

        return {
            makerFee: makerFeeAmount,
            takerFee: takerFeeAmount,
            totalFee: makerFeeAmount + takerFeeAmount,
            leveragedValue,
            symbol
        };
    }

    async getServerTime() {
        const endpoint = "/v1/market/time";
        const response = await this.sendRequest(endpoint, "GET");
        return parseInt(response.data.serverTime);
    }

    async getExchangeInfo() {
        const endpoint = "/v1/market/contracts";
        return this.sendRequest(endpoint, "GET");
    }

    async modifyMarginType(symbol, marginType) {
        const endpoint = "/v1/positions/margin-type";
        const payload = {
            symbol,
            marginType // 'ISOLATED' or 'CROSSED'
        };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async getMarginInfo(symbol) {
        const endpoint = "/v1/positions/margin-info";
        const payload = { symbol };
        return this.sendRequest(endpoint, "GET", payload);
    }

    async updateOrderSize(orderId, newSize) {
        const endpoint = "/v1/order/update";
        const payload = {
            orderId,
            quantity: newSize
        };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async updateOrder(orderId, params) {
        const endpoint = "/v1/order/update";
        const payload = {
            orderId,
            ...params
        };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async calculateAdjustedPrice(trade) {
        const orderbook = await this.getOrderBook(trade.symbol);
        const spread = orderbook.asks[0][0] - orderbook.bids[0][0];
        const adjustmentFactor = trade.direction === 'buy' ? 1 + (spread * 0.1) : 1 - (spread * 0.1);
        return trade.entryPrice * adjustmentFactor;
    }

    async closePosition(orderId) {
        const endpoint = "/v1/position/close";
        const payload = { orderId };
        try {
            const response = await this.sendRequest(endpoint, "POST", payload);
            return response.success;
        } catch (error) {
            logger.error(`Failed to close position: ${error.message}`);
            return false;
        }
    }

    async emergencyClosePosition(orderId, options = {}) {
        const endpoint = "/v1/position/emergency-close";
        const payload = {
            orderId,
            slippageTolerance: options.slippage || 0.05,
            forceMarket: options.forceMarket || false
        };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async getTechnicalIndicators(symbol, timeframe) {
        // Get OHLCV data for calculations
        const klines = await this.getKlines(symbol, timeframe);

        return {
            rsi: await this.calculateRSI(klines),
            macd: await this.calculateMACD(klines),
            volume: await this.calculateVolumeMetrics(klines),
            ema: await this.calculateEMA(klines)
        };
    }

    async calculateRSI(klines, period = 14) {
        const closes = klines.map(k => parseFloat(k[4])); // Close prices
        let gains = 0;
        let losses = 0;

        // Calculate initial RSI
        for (let i = 1; i < period + 1; i++) {
            const difference = closes[i] - closes[i - 1];
            if (difference >= 0) {
                gains += difference;
            } else {
                losses -= difference;
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return {
            value: rsi,
            period: period,
            overbought: rsi > 70,
            oversold: rsi < 30
        };
    }

    async calculateMACD(klines, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const closes = klines.map(k => parseFloat(k[4]));
        const fastEMA = this.calculateEMAValues(closes, fastPeriod);
        const slowEMA = this.calculateEMAValues(closes, slowPeriod);

        const macdLine = fastEMA - slowEMA;
        const signalLine = this.calculateEMAValues([macdLine], signalPeriod);
        const histogram = macdLine - signalLine;

        return {
            macdLine,
            signalLine,
            histogram,
            trend: macdLine > signalLine ? 'bullish' : 'bearish'
        };
    }

    async calculateVolumeMetrics(klines) {
        const volumes = klines.map(k => parseFloat(k[5]));
        const prices = klines.map(k => parseFloat(k[4]));

        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = volumes[volumes.length - 1];

        return {
            currentVolume,
            averageVolume: avgVolume,
            volumeRatio: currentVolume / avgVolume,
            isHighVolume: currentVolume > avgVolume * 1.5,
            priceVolumeCorrelation: this.calculatePriceVolumeCorrelation(prices, volumes)
        };
    }

    calculatePriceVolumeCorrelation(prices, volumes) {
        // Calculate correlation coefficient between price and volume
        const n = prices.length;
        const sumPrices = prices.reduce((a, b) => a + b, 0);
        const sumVolumes = volumes.reduce((a, b) => a + b, 0);
        const sumPricesVolumes = prices.reduce((sum, price, i) => sum + price * volumes[i], 0);
        const sumPricesSquared = prices.reduce((sum, price) => sum + price * price, 0);
        const sumVolumesSquared = volumes.reduce((sum, volume) => sum + volume * volume, 0);

        const correlation = (n * sumPricesVolumes - sumPrices * sumVolumes) /
            Math.sqrt((n * sumPricesSquared - sumPrices * sumPrices) *
                (n * sumVolumesSquared - sumVolumes * sumVolumes));

        return {
            coefficient: correlation,
            strength: Math.abs(correlation),
            direction: correlation > 0 ? 'positive' : 'negative'
        };
    }

    calculateEMAValues(data, period) {
        const multiplier = 2 / (period + 1);
        let ema = data[0];

        for (let i = 1; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            clearInterval(this.heartbeatInterval);
            this.ws = null;
            this.heartbeatInterval = null;
            console.log("WebSocket disconnected and cleaned up");
        }
    }
}

module.exports = BTCCClient;