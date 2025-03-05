describe('Brinks Box Strategy Integration', () => {
    test('should correctly identify and execute Brinks Box setup', async () => {
        const marketData = generateTestMarketData();
        const strategy = new BrinksBoxStrategy();
        const signal = await strategy.analyze(marketData);
        
        expect(signal).toMatchObject({
            isValid: true,
            entry: expect.any(Number),
            stopLoss: expect.any(Number),
            takeProfit: expect.any(Number)
        });
    });
});