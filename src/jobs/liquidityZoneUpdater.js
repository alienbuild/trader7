const { updateLiquidityZones } = require("../utils/liquidityZones");
const BTCCClient = require("../api/btcc/BTCCClient");

async function refreshLiquidityZones() {
    const symbols = ["BTC/USD", "EUR/USD", "GBP/USD"]; // Add relevant symbols

    for (const symbol of symbols) {
        const recentCandles = await BTCCClient.getRecentCandles(symbol, "1H"); // Fetch recent market data
        await updateLiquidityZones(symbol, recentCandles);
        console.log(`Liquidity zones updated for ${symbol}`);
    }
}

// Run every 10 minutes
setInterval(refreshLiquidityZones, 10 * 60 * 1000);
