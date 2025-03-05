const BTCCClient = require("../api/btcc/BTCCClient");
const { PrismaClient } = require("@prisma/client");
const monitor = require('../utils/monitor');
const logger = require('../utils/logger');

class SystemHealthCheck {
    static async performHealthCheck() {
        try {
            const prisma = new PrismaClient();
            const btccClient = new BTCCClient();

            const [databaseHealth, exchangeHealth, marketDataHealth] = await Promise.allSettled([
                this.checkDatabase(prisma),
                this.checkExchangeConnection(btccClient),
                this.checkMarketDataFeed(btccClient)
            ]);

            const health = {
                database: databaseHealth.status === 'fulfilled' && databaseHealth.value,
                exchange: exchangeHealth.status === 'fulfilled' && exchangeHealth.value,
                marketData: marketDataHealth.status === 'fulfilled' && marketDataHealth.value,
                memory: this.checkMemoryUsage(),
                cpu: this.checkCPUUsage(),
                timestamp: new Date().toISOString()
            };

            // Track health metrics
            monitor.trackMetric('system_health', health);

            return health;
        } catch (error) {
            logger.error(`Health check failed: ${error.message}`);
            monitor.trackError(error, { context: 'system_health_check' });
            throw error;
        }
    }

    static async checkDatabase(prisma) {
        try {
            // Simple query to check database connectivity
            await prisma.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            logger.error(`Database health check failed: ${error.message}`);
            return false;
        } finally {
            await prisma.$disconnect();
        }
    }

    static async checkExchangeConnection(btccClient) {
        try {
            // Check if WebSocket is connected
            const wsStatus = btccClient.ws && btccClient.ws.readyState === 1;
            
            // Test API connectivity
            const apiStatus = await btccClient.getServerTime();
            
            return wsStatus && apiStatus;
        } catch (error) {
            logger.error(`Exchange health check failed: ${error.message}`);
            return false;
        }
    }

    static async checkMarketDataFeed(btccClient) {
        try {
            // Check if we're receiving recent price updates
            const lastPrice = btccClient.latestPrice;
             // Within last minute
            return lastPrice && (Date.now() - lastPrice.timestamp) < 60000;
        } catch (error) {
            logger.error(`Market data health check failed: ${error.message}`);
            return false;
        }
    }

    static checkMemoryUsage() {
        const used = process.memoryUsage();
        return {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(used.heapTotal / 1024 / 1024), // MB
            usedPercent: Math.round((used.heapUsed / used.heapTotal) * 100)
        };
    }

    static checkCPUUsage() {
        const cpus = require('os').cpus();
        const totalUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total);
        }, 0);

        return {
            usagePercent: Math.round((totalUsage / cpus.length) * 100),
            cores: cpus.length
        };
    }
}

module.exports = SystemHealthCheck;