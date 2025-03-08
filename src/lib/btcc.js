const BTCCClient = require('../api/btcc/BTCCClient');

// Export a configured instance
const btccClient = new BTCCClient();

module.exports = {
    BTCCClient,
    btccClient
};