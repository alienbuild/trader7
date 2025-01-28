require('dotenv').config();
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const schema = require('./api/schema/schema');
const AlertService = require('./services/AlertService');
const logger = require('./utils/logger');

const app = express();

// Parse incoming JSON payloads
app.use(express.json());

// Webhook endpoint for TradingView alerts
app.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        logger.info(`Received webhook payload: ${JSON.stringify(payload)}`);

        // Process the alert
        const result = await AlertService.handleAlert(payload);

        res.status(200).json({ success: true, message: 'Alert processed', result });
    } catch (err) {
        logger.error(`Error processing webhook: ${err.message}`);
        res.status(500).json({ success: false, message: 'Internal server error' });
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});
