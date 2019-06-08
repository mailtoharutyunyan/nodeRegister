const TokenManager = require('../helpers/TokenManager');
const authConfig = require('../config/auth');

const tokenManager = new TokenManager(
    authConfig.secret,
    {
        expiresIn: 60 * 60 * 24,
        algorithm: 'HS256',
        noTimestamp: false
    }
);

module.exports = tokenManager;
