const fetch = require('node-fetch');

class BtccClient {
    static async createTrade({ symbol, direction, price, leverage, takeProfit, stopLoss }) {
        const url = process.env.BTCC_API_URL + '/trade';
        const apiKey = process.env.BTCC_API_KEY;

        const payload = {
            symbol,
            direction,
            price,
            leverage,
            takeProfit,
            stopLoss,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        return response.json();
    }
}

module.exports = BtccClient;
