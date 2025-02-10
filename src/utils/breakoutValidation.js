function isValidBreakout(candle, volumeThreshold, marketSession) {
    return candle.close > candle.high * 1.001 && // Breakout condition
        candle.volume > volumeThreshold &&
        ["London", "New York"].includes(marketSession); // Only during strong sessions
}

module.exports = { isValidBreakout };
