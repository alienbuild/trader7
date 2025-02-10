function calculatePositionSize(accountBalance, riskPercentage, stopLossDistance) {
    const riskAmount = (accountBalance * (riskPercentage / 100));
    return Math.floor(riskAmount / stopLossDistance);
}

module.exports = { calculatePositionSize };