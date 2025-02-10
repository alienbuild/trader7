const axios = require("axios");

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function sendSlackAlert(message) {
    if (!SLACK_WEBHOOK_URL) {
        console.error("❌ Slack Webhook URL is missing. Add it to your .env file.");
        return;
    }

    try {
        await axios.post(SLACK_WEBHOOK_URL, {
            text: `🚨 *BTCC WebSocket Alert*\n${message}`,
        });
        console.log("✅ Slack alert sent:", message);
    } catch (error) {
        console.error("❌ Failed to send Slack alert:", error.message);
    }
}

module.exports = { sendSlackAlert };
