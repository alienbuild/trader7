const Sentry = require('@sentry/node');

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
});

const monitor = {
    trackError: (error, context = {}) => {
        Sentry.captureException(error, { extra: context });
    },
    trackMetric: (name, value, tags = {}) => {
        Sentry.addBreadcrumb({
            category: 'metrics',
            message: `${name}: ${value}`,
            data: tags
        });
    }
};

module.exports = monitor;