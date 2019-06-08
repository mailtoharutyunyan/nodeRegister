const responseManager = require('../managers/ResponseManager');
const Tokenizer = require('../modules/Tokenizer');
const AppError = require('../managers/AppError');
const authConfig = require('../config/auth');
const User = require('../model/User');

module.exports = (role) => async (req, res, next) => {
    const responseHandler = responseManager.getResponseHandler(res);
    const token = (req.body && req.body.token) || (req.query && req.query.token) || req.headers['x-access-token'];
    if (token) {
        try {
            const decoded = await Tokenizer.decode(token, authConfig.secret);
            if (decoded.uid) {
                const user = await User.findOne({_id: decoded.uid});
                if (user && (!role || role.includes(user.role))) {
                    req.session = decoded;
                    next();
                } else {
                    return responseHandler.onError(new AppError("Invalid credentials", 401));
                }
            } else {
                return responseHandler.onError(new AppError("Invalid Access Token.", 403));
            }
        } catch (e) {
            return responseHandler.onError(new AppError("Invalid Access Token.", 401));
        }
    } else {
        return responseHandler.onError(new AppError("No Access Token.", 401));
    }
};
