const RiskManager = require('../services/RiskManager');
const cron = require('node-cron');

const riskManager = new RiskManager();

// Run risk checks every minute
cron.schedule('* * * * *', async () => {
    try {
        await riskManager.checkRiskThresholds('BTC-USD');
    } catch (error) {
        console.error('Risk monitoring failed:', error);
    }
});