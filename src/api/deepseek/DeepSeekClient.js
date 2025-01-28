const fetch = require('node-fetch');

class DeepSeekClient {
    static async analyzeSignal(payload) {
        // Send payload (including the prompt) to the DeepSeek API
        const response = await fetch('https://your-deepseek-api-endpoint.com/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), // The payload now includes the prompt from AlertService
        });

        // Handle response
        if (!response.ok) {
            throw new Error(`DeepSeek API error: ${response.statusText}`);
        }

        return await response.json();
    }
}

module.exports = DeepSeekClient;
