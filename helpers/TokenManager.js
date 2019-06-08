const jwt = require('jsonwebtoken');

module.exports = class TokenManager {
    constructor(privateKey, options) {
        this.privateKey = privateKey;
        this.options = options;
    }

    encode(payload, signOptions) {
        const jwtSignOptions = Object.assign({}, signOptions, this.options);
        return jwt.sign(payload, this.privateKey, jwtSignOptions);
    };

    decode(token, privateKey) {
        return new Promise((res, rej) => {
            jwt.verify(token, privateKey, null, (err, decoded) => {
                if (err) {
                    return rej(err);
                }
                res(decoded);
            });
        });
    };
};
