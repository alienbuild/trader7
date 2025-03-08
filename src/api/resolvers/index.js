
const tradeResolvers = require('./tradeResolvers');
const analyticsResolvers = require('./analyticsResolvers');
const positionResolvers = require('./positionResolvers');

const resolvers = {
    Query: {
        ...tradeResolvers.Query,
        ...analyticsResolvers.Query
    },
    Position: positionResolvers.Position,
    Mutation: {
        ...tradeResolvers.Mutation
    }
};

module.exports = resolvers;
