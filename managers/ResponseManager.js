const ResponseBase = {
    "success": false,
    "message": "",
    "data": {}
};

class ResponseManager {
    static getResponseHandler(res) {
        return {
            onSuccess: function (data, message, code) {
                ResponseManager.respondWithSuccess(res, code || 200, data, message);
            },
            onError: function (error, data) {
                if (error instanceof Error && !data && process.env.NODE_ENV === 'development') {
                    data = JSON.stringify(error, Object.getOwnPropertyNames(error));
                }
                ResponseManager.respondWithError(res, error.httpStatus || 500, error.message || 'Unknown error', data);
            }
        };
    }

    static respondWithSuccess(res, code, data, message = "") {
        let response = Object.assign({}, ResponseBase);
        response.success = true;
        response.message = message;
        response.data = data;
        res.status(code).json(response);
    }

    static respondWithError(res, errorCode, message = "", data) {
        let response = Object.assign({}, ResponseBase);
        response.success = false;
        response.message = message;
        response.data = data;
        res.status(errorCode).json(response);
    }
}

module.exports = ResponseManager;
