require('dotenv').config();
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const schema = require('./api/schema/schema.graphql');
const AlertService = require('./services/AlertService');
const SystemHealthCheck = require('./health/systemCheck');
const SessionManager = require('./services/SessionManager');
const TradeJournal = require('./services/TradeJournal');
const PerformanceTracker = require('./services/PerformanceTracker');
const logger = require('./utils/logger');

const app = express();

// Middleware for basic security
app.use(express.json());
app.use((req, res, next) => {
    // Basic API key validation
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const health = await SystemHealthCheck.performHealthCheck();
        res.status(health.database && health.exchange ? 200 : 500).json(health);
    } catch (error) {
        logger.error(`Health check failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Session status endpoint
app.get('/session/status', async (req, res) => {
    try {
        const status = await SessionManager.validateBrinksBoxSession();
        res.json(status);
    } catch (error) {
        logger.error(`Session status check failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Performance metrics endpoint
app.get('/performance/:strategy', async (req, res) => {
    try {
        const metrics = await PerformanceTracker.trackStrategy(req.params.strategy);
        res.json(metrics);
    } catch (error) {
        logger.error(`Performance tracking failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Trade journal endpoint
app.get('/journal', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const trades = await TradeJournal.getTrades(page, limit);
        res.json(trades);
    } catch (error) {
        logger.error(`Trade journal retrieval failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Webhook endpoint for TradingView alerts
app.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        logger.info(`Received webhook payload: ${JSON.stringify(payload)}`);

        // Validate session first
        const sessionStatus = await SessionManager.validateBrinksBoxSession();
        if (!sessionStatus.isValid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Outside trading session hours'
            });
        }

        const result = await AlertService.handleAlert(payload);
        res.status(200).json({ success: true, result });
    } catch (err) {
        logger.error(`Error processing webhook: ${err.message}`);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GraphQL endpoint
app.use(
    '/graphql',
    graphqlHTTP({
        schema,
        graphiql: process.env.NODE_ENV !== 'production',
    })
);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
    try {
        // Initial health check
        const health = await SystemHealthCheck.performHealthCheck();
        if (!health.database || !health.exchange) {
            throw new Error('Critical systems unavailable');
        }
        
        logger.info(`Server running on http://localhost:${PORT}`);
        logger.info('All systems operational');
    } catch (error) {
        logger.error(`Server startup failed: ${error.message}`);
        process.exit(1);
    }
});

module.exports = app;
