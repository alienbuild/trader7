const fetch = require('node-fetch');
const Bottleneck = require('bottleneck'); // For rate limiting

class BTCCClient {
    constructor() {
        this.baseUrl = process.env.BTCC_API_URL || 'https://api.btcc.com';
        this.apiKey = process.env.BTCC_API_KEY;
        this.apiSecret = process.env.BTCC_API_SECRET;

        // Initialize rate limiter to avoid hitting API rate limits
        this.rateLimiter = new Bottleneck({
            maxConcurrent: 1,
            minTime: 1000, // Adjust based on BTCC API rate limit
        });
    }

    // Helper for authenticated requests
    async sendRequest(endpoint, method, body = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };

        const options = {
            method,
            headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await this.rateLimiter.schedule(() => fetch(url, options));

        if (!response.ok) {
            const errorResponse = await response.json();
            throw new Error(`BTCC API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorResponse)}`);
        }

        return response.json();
    }

    // Place an order
    async placeOrder({ symbol, price, quantity, side, leverage, type = 'limit' }) {
        const endpoint = '/api/v1/order';
        const payload = {
            symbol,
            price,
            quantity,
            side, // "buy" or "sell"
            leverage, // e.g., 50x, 100x
            type, // "limit" or "market"
        };

        return this.sendRequest(endpoint, 'POST', payload);
    }

    // Get account balance
    async getBalance() {
        const endpoint = '/api/v1/account/balance';
        return this.sendRequest(endpoint, 'GET');
    }

    // Fetch active orders
    async getActiveOrders(symbol) {
        const endpoint = `/api/v1/orders?symbol=${symbol}`;
        return this.sendRequest(endpoint, 'GET');
    }

    // Cancel an order
    async cancelOrder(orderId) {
        const endpoint = `/api/v1/order/cancel`;
        const payload = { orderId };
        return this.sendRequest(endpoint, 'POST', payload);
    }

    // Get order details
    async getOrder(orderId) {
        const endpoint = `/api/v1/order/${orderId}`;
        return this.sendRequest(endpoint, 'GET');
    }

    // Fetch market data for a symbol
    async getMarketData(symbol) {
        const endpoint = `/api/v1/market?symbol=${symbol}`;
        return this.sendRequest(endpoint, 'GET');
    }

    // Calculate fees based on BTCC's fee structure
    calculateFees({ quantity, price, leverage, feeRate }) {
        const tradeValue = quantity * price * leverage; // Total leveraged trade value
        const fees = tradeValue * feeRate; // Maker or taker fee
        return fees;
    }

    async getFees() {
        const url = `${this.apiUrl}/fees`; // Adjust this to match the actual BTCC endpoint for fees
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch fees: ${response.statusText}`);
        }

        const data = await response.json();

        // Assuming the response includes maker, taker, and withdrawal fees
        return {
            makerFee: data.makerFee,
            takerFee: data.takerFee,
            withdrawalFee: data.withdrawalFee,
        };
    }
}

module.exports = BTCCClient;
