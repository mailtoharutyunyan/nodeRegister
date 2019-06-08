const bcrypt = require('bcrypt-nodejs');

class BCrypt {
    static hash(password) {
        return new Promise((resolve, reject) => {
            bcrypt.genSalt(10, (err, salt) => {
                if (err) {
                    return reject(err);
                }
                bcrypt.hash(password, salt, null, (error, hash) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(hash);
                })
            });
        });
    }

    static compare(plain, hash) {
        return new Promise((resolve, reject) => {
            bcrypt.compare(plain, hash, (err, res) => {
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
        });
    }
}

module.exports = BCrypt;