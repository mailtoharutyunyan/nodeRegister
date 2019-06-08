const AppError = require("../managers/AppError");
const User = require("../model/User");
const BCrypt = require("../helpers/BCrypt");
const Tokenizer = require("../modules/Tokenizer");
const authConfig = require('../config/auth');


class AuthService {
    static async login(username, password, callback) {
        const user = await User.findOne({username: {$in: [username.toLowerCase()]}});

        if (user) {
            console.log(true)
        } else {
            console.log(false)
        }
        if (!user || user.isDisabled) {
            return callback.onError(new AppError('Wrong username or password1', 404));
        }

        const doesPasswordMatch = await BCrypt.compare(password, user.password);
        if (!doesPasswordMatch) {
            return callback.onError(new AppError('Wrong username or password2', 404));
        }

        const token = Tokenizer.encode({
            uid: user._id,
            role: user.role,
        });
        user.status = 1;
        await user.save();
        callback.onSuccess({
            name: user.name,
            username: user.username,
            role: user.role,
            status: user.status,
            // create_new_password: user.status === 0 || undefined,
            token
        });
    }

    static async initSession(req, callback) {
        const token = (req.body && req.body.token) || (req.query && req.query.token) || req.headers['x-access-token'];
        if (token) {
            try {
                const decoded = await Tokenizer.decode(token, authConfig.secret);
                if (decoded.uid) {
                    const user = await User.findOne({_id: decoded.uid});
                    if (user) {
                        callback.onSuccess({
                            name: user.name,
                            username: user.username,
                            role: user.role,
                            // create_new_password: user.status === 0 || undefined,
                            token
                        });
                    } else {
                        return callback.onError(new AppError("Invalid credentials", 401));
                    }
                } else {
                    return callback.onError(new AppError("Invalid Access Token.", 403));
                }
            } catch (e) {
                return callback.onError(new AppError("Invalid Access Token.", 403));
            }
        } else {
            return callback.onError(new AppError("No Access Token.", 401));
        }
    }

    static async register(data, callback) {
        try {
            const user = new User(data);
            user.email = data.email.toLowerCase();
            user.username = data.username.toLowerCase();
            user.password = await BCrypt.hash(data.password.toLowerCase());
            const newUser = await user.save();
            const token = Tokenizer.encode({
                uid: user._id,
                role: user.role,
            });
            callback.onSuccess({
                name: data.name,
                email: data.email,
                // password: data.password
                token
            }, "Successfully Registered", 201);
            return newUser;
        } catch (e) {
            callback.onError(e)
        }
    }




    static async logout(req, callback) {
        try {
            const user = await User.findOne({_id: req.session.uid});
            if (user) {
                user.status = 0;
                user.save();
                return callback.onSuccess({}, "Logged out", 200)
            }
        } catch (e) {
            throw new AppError('User not found', 404);
        }
    }
}

module.exports = AuthService;