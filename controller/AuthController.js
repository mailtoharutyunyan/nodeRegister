const AuthService = require("../service/AuthService");
const ResponseManager = require("../managers/ResponseManager");

class AuthController {
    static async login(req, res) {

        const responseHandler = ResponseManager.getResponseHandler(res);
        try {
            await AuthService.login(req.body.username, req.body.password, responseHandler);

        } catch (e) {
            responseHandler.onError(e);
        }
    }

    static async initSession(req, res) {
        const responseHandler = ResponseManager.getResponseHandler(res);
        try {
            await AuthService.initSession(req, responseHandler);
        } catch (e) {
            responseHandler.onError(e);
        }
    }

    static async register(req, res) {
        const responseHandler = ResponseManager.getResponseHandler(res);
        try {
            await AuthService.register(req.body, responseHandler);
        } catch (e) {
            responseHandler.onError(e);
        }
    }




    static async logout(req, res) {
        const responseHandler = ResponseManager.getResponseHandler(res);
        try {
            await AuthService.logout(req, responseHandler)
        } catch (e) {
            responseHandler.onError(e);
        }
    }
}

module.exports = AuthController;
