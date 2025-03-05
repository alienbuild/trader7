const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Define log directory
const LOG_DIR = path.join(process.cwd(), 'logs');

// Create rotating transport for errors
const errorRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat
});

// Create rotating transport for combined logs
const combinedRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat
});

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'trader7' },
    transports: [
        // Write all logs with level 'error' and below to error.log
        errorRotateTransport,
        // Write all logs with level 'info' and below to combined.log
        combinedRotateTransport
    ]
});

// If we're not in production, log to the console with colors
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Add custom logging methods for trade-specific events
logger.trade = (message, tradeData) => {
    logger.info(message, { ...tradeData, type: 'TRADE' });
};

logger.strategy = (message, strategyData) => {
    logger.info(message, { ...strategyData, type: 'STRATEGY' });
};

logger.alert = (message, alertData) => {
    logger.info(message, { ...alertData, type: 'ALERT' });
};

logger.performance = (message, performanceData) => {
    logger.info(message, { ...performanceData, type: 'PERFORMANCE' });
};

// Error handling for the logger itself
errorRotateTransport.on('error', (error) => {
    console.error('Error in error logging transport:', error);
});

combinedRotateTransport.on('error', (error) => {
    console.error('Error in combined logging transport:', error);
});

module.exports = logger;
