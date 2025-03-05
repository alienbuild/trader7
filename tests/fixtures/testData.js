const determineSession = (date) => {
    const hour = date.getUTCHours();
    
    if (hour >= 0 && hour < 8) {
        return 'ASIA';
    } else if (hour >= 8 && hour < 16) {
        return 'LONDON';
    } else {
        return 'NEW_YORK';
    }
};

const generateTestData = (startDate, endDate, interval = '15m') => {
    const data = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
        const basePrice = 40000 + Math.random() * 2000;
        
        data.push({
            timestamp: currentDate.getTime(),
            symbol: 'BTC-USD',
            timeframe: interval,
            open: basePrice,
            high: basePrice + Math.random() * 200,
            low: basePrice - Math.random() * 200,
            close: basePrice + (Math.random() * 400 - 200),
            volume: Math.floor(Math.random() * 1000),
            ema_50: basePrice + (Math.random() * 100 - 50),
            ema_200: basePrice + (Math.random() * 100 - 50),
            ema_800: basePrice + (Math.random() * 100 - 50),
            session: determineSession(currentDate)
        });

        // Increment timestamp based on interval
        switch (interval) {
            case '15m':
                currentDate.setMinutes(currentDate.getMinutes() + 15);
                break;
            case '1h':
                currentDate.setHours(currentDate.getHours() + 1);
                break;
            case '4h':
                currentDate.setHours(currentDate.getHours() + 4);
                break;
            case '1d':
                currentDate.setDate(currentDate.getDate() + 1);
                break;
            default:
                throw new Error(`Unsupported interval: ${interval}`);
        }
    }
    
    return data;
};

const generateBrinksBoxData = (baseTimestamp) => {
    const timestamp = new Date(baseTimestamp);
    const data = [];
    const basePrice = 40000;

    // Generate 4 15-minute candles for the Brinks Box
    for (let i = 0; i < 4; i++) {
        const candle = {
            timestamp: timestamp.getTime(),
            symbol: 'BTC-USD',
            timeframe: '15m',
            open: basePrice + (Math.random() * 200 - 100),
            high: basePrice + 150,
            low: basePrice - 150,
            close: basePrice + (Math.random() * 200 - 100),
            volume: Math.floor(Math.random() * 1000),
            session: determineSession(timestamp)
        };

        // Add Brinks Box levels after the box is formed (after 4th candle)
        if (i === 3) {
            const allCandles = [...data, candle];
            const boxHigh = Math.max(...allCandles.map(c => c.high));
            const boxLow = Math.min(...allCandles.map(c => c.low));
            
            allCandles.forEach(c => {
                c.brinks_high = boxHigh;
                c.brinks_low = boxLow;
            });
        }

        data.push(candle);
        timestamp.setMinutes(timestamp.getMinutes() + 15);
    }

    return data;
};

const generateMarketCycleData = (startDate, numCycles = 1) => {
    const data = [];
    let currentDate = new Date(startDate);
    const basePrice = 40000;
    
    for (let cycle = 0; cycle < numCycles; cycle++) {
        // Generate Level 1 (New low formation)
        for (let i = 0; i < 24; i++) {
            data.push({
                timestamp: currentDate.getTime(),
                symbol: 'BTC-USD',
                timeframe: '1h',
                open: basePrice - (i * 50),
                high: basePrice - (i * 50) + 25,
                low: basePrice - (i * 50) - 25,
                close: basePrice - ((i + 1) * 50),
                volume: Math.floor(Math.random() * 1000),
                market_cycle_level: 1,
                session: determineSession(currentDate)
            });
            currentDate.setHours(currentDate.getHours() + 1);
        }

        // Generate Level 2 (Mid push continuation)
        const level2Base = basePrice - 1200;
        for (let i = 0; i < 24; i++) {
            data.push({
                timestamp: currentDate.getTime(),
                symbol: 'BTC-USD',
                timeframe: '1h',
                open: level2Base + (i * 75),
                high: level2Base + (i * 75) + 25,
                low: level2Base + (i * 75) - 25,
                close: level2Base + ((i + 1) * 75),
                volume: Math.floor(Math.random() * 1000),
                market_cycle_level: 2,
                session: determineSession(currentDate)
            });
            currentDate.setHours(currentDate.getHours() + 1);
        }

        // Generate Level 3 (Peak formation)
        const level3Base = level2Base + 1800;
        for (let i = 0; i < 24; i++) {
            data.push({
                timestamp: currentDate.getTime(),
                symbol: 'BTC-USD',
                timeframe: '1h',
                open: level3Base + (i * 25),
                high: level3Base + (i * 25) + 50,
                low: level3Base + (i * 25) - 50,
                close: level3Base + ((i + 1) * 25),
                volume: Math.floor(Math.random() * 1000),
                market_cycle_level: 3,
                session: determineSession(currentDate)
            });
            currentDate.setHours(currentDate.getHours() + 1);
        }
    }
    
    return data;
};

const generateLiquiditySweepData = (baseTimestamp) => {
    const data = [];
    let timestamp = new Date(baseTimestamp);
    const basePrice = 40000;

    // Generate a liquidity sweep scenario
    // 1. Initial accumulation
    // 2. Stop hunt low
    // 3. Recovery and sweep high
    const scenarios = [
        { phase: 'accumulation', length: 12, priceChange: 100 },
        { phase: 'stop_hunt', length: 4, priceChange: -300 },
        { phase: 'recovery', length: 8, priceChange: 400 }
    ];

    scenarios.forEach(({ phase, length, priceChange }) => {
        for (let i = 0; i < length; i++) {
            const progress = i / length;
            const currentPrice = basePrice + (priceChange * progress);
            
            data.push({
                timestamp: timestamp.getTime(),
                symbol: 'BTC-USD',
                timeframe: '15m',
                open: currentPrice,
                high: currentPrice + Math.random() * 50,
                low: currentPrice - Math.random() * 50,
                close: currentPrice + (Math.random() * 100 - 50),
                volume: Math.floor(Math.random() * 1000 + 500),
                liquidity_phase: phase,
                session: determineSession(timestamp)
            });

            timestamp.setMinutes(timestamp.getMinutes() + 15);
        }
    });

    return data;
};

const addVectorCandles = (data) => {
    return data.map((candle, index) => {
        const prevCandle = index > 0 ? data[index - 1] : null;
        
        // Determine if this is a vector candle based on volume and price movement
        const isVectorCandle = candle.volume > (prevCandle?.volume * 1.5 || 0) &&
            Math.abs(candle.close - candle.open) > Math.abs(prevCandle?.close - prevCandle?.open || 0) * 1.5;

        return {
            ...candle,
            is_vector: isVectorCandle,
            vector_type: isVectorCandle ? (candle.close > candle.open ? 'green' : 'red') : null
        };
    });
};

const generateCompleteTestSet = (startDate, endDate) => {
    const allData = [];
    
    // Generate standard market data
    const marketData = generateTestData(startDate, endDate, '15m');
    allData.push(...marketData);

    // Add Brinks Box scenarios
    const brinksData = generateBrinksBoxData(startDate);
    allData.push(...brinksData);

    // Add Market Cycle data
    const cycleData = generateMarketCycleData(startDate, 2);
    allData.push(...cycleData);

    // Add Liquidity Sweep scenarios
    const liquidityData = generateLiquiditySweepData(startDate);
    allData.push(...liquidityData);

    // Add vector candles
    const dataWithVectors = addVectorCandles(allData);

    // Sort by timestamp
    return dataWithVectors.sort((a, b) => a.timestamp - b.timestamp);
};

// Helper function to format dates for test data
const formatDate = (date) => {
    return date.toISOString();
};

// Export all the generator functions and utilities
module.exports = {
    generateTestData,
    generateBrinksBoxData,
    generateMarketCycleData,
    generateLiquiditySweepData,
    generateCompleteTestSet,
    addVectorCandles,
    determineSession,
    formatDate
};