const Bottleneck = require("bottleneck");
const WebSocket = require("ws");
const {sendSlackAlert} = require("../../utils/slackNotifier");

class BTCCClient {
    constructor() {
        this.baseUrl = process.env.BTCC_API_URL || "https://api1.btloginc.com:9081";
        this.apiKey = process.env.BTCC_API_KEY;
        this.apiSecret = process.env.BTCC_API_SECRET;

        this.rateLimiter = new Bottleneck({
            maxConcurrent: 1,
            minTime: 500,
        });

        this.ws = null;
        this.latestPrice = null;
        this.heartbeatInterval = null;
        this.connectWebSocket();
    }

    // WebSocket connection handling
    connectWebSocket() {
        this.ws = new WebSocket("wss://kapi1.btloginc.com:9082");

        this.ws.on("open", () => {
            console.log("Connected to BTCC WebSocket");
            sendSlackAlert("*WebSocket Connected* to BTCC API.");
            this.ws.send(
                JSON.stringify({
                    action: "ReqSubcri",
                    symbols: ["BTC/USDT"],
                    deep: "BTC/USDT",
                })
            );

            this.startHeartbeat();

        });

        this.ws.on("message", (data) => {
            const message = JSON.parse(data);
            if (message.action === "tickinfo" && message.data.length > 0) {
                this.latestPrice = message.data[0].C;
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
                this.ws.send(JSON.stringify({ action: "heartbeat" }));
            } else {
                console.log("❌ WebSocket is not open. Attempting to reconnect...");
                sendSlackAlert("⚠️ *WebSocket heartbeat failed.* Attempting to reconnect...");
                clearInterval(this.heartbeatInterval);
                this.connectWebSocket();
            }
        }, 15000);
    }

    async sendRequest(endpoint, method, body = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
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
        const endpoint = "/v1/account/openposition";
        const payload = {
            token: this.apiKey,
            symbol,
            direction: side === "buy" ? 1 : 2,
            request_volume: quantity,
            request_price: price,
            multiple: leverage,
            sign: this.apiSecret,
        };

        return this.sendRequest(endpoint, "POST", payload);
    }

    async getMarketPrice() {
        return this.latestPrice;
    }

    async getBalance() {
        const endpoint = "/api/v1/account/balance";
        return this.sendRequest(endpoint, "GET");
    }

    async getOrderBook(symbol, depth = 10) {
        const endpoint = `/api/v1/order_book?symbol=${symbol}&depth=${depth}`;
        return this.sendRequest(endpoint, "GET");
    }

    async getActiveOrders(symbol) {
        const endpoint = `/api/v1/orders?symbol=${symbol}`;
        return this.sendRequest(endpoint, "GET");
    }

    async getFees() {
        const endpoint = "/api/v1/account/fees";
        const data = await this.sendRequest(endpoint, "GET");

        return {
            makerFee: parseFloat(data.makerFee),
            takerFee: parseFloat(data.takerFee),
            withdrawalFee: parseFloat(data.withdrawalFee),
        };
    }

    async cancelOrder(orderId) {
        const orderDetails = await this.getOrder(orderId);
        if (!orderDetails) {
            throw new Error(`Order ${orderId} not found or already canceled.`);
        }

        const endpoint = `/api/v1/order/cancel`;
        const payload = { orderId };
        return this.sendRequest(endpoint, "POST", payload);
    }

    async getOrder(orderId) {
        const endpoint = `/api/v1/order/${orderId}`;
        return this.sendRequest(endpoint, "GET");
    }

    async calculateFees({ quantity, price, leverage }) {
        const fees = await this.getFees();

        const tradeValue = quantity * price * leverage;
        const makerFeeAmount = tradeValue * (fees.makerFee / 100);
        const takerFeeAmount = tradeValue * (fees.takerFee / 100);

        return {
            makerFee: makerFeeAmount,
            takerFee: takerFeeAmount,
            totalFee: makerFeeAmount + takerFeeAmount,
        };
    }
}

module.exports = BTCCClient;