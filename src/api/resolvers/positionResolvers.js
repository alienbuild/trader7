const TradeService = require('../../services/TradeService');

const positionResolvers = {
    Position: {
        modifications: async (parent) => {
            const tradeService = new TradeService();
            return tradeService.getPositionModifications(parent.id);
        },
        close: async (parent) => {
            const tradeService = new TradeService();
            return tradeService.getPositionClose(parent.id);
        },
        metrics: async (parent) => {
            const tradeService = new TradeService();
            return tradeService.calculatePositionMetrics(parent);
        }
    }
};

module.exports = positionResolvers;