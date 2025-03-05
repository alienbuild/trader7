const logger = require('./logger');

class TradeError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'TradeError';
        this.code = code;
        this.details = details;
    }
}

const errorHandler = (err, req, res, next) => {
    logger.error(`Error: ${err.message}`, { 
        stack: err.stack,
        code: err.code,
        details: err.details 
    });

    if (err instanceof TradeError) {
        return res.status(400).json({
            success: false,
            error: err.message,
            code: err.code
        });
    }

    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
};

module.exports = { TradeError, errorHandler };