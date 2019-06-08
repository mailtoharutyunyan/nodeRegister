const UserService = require("../service/UserService");
const {check} = require('express-validator/check');

const registerValidator = [
    check('name').exists().custom(value => value.length > 0),
    check('email', 'Invalid email format , missing <@>').exists().contains('@'),
    check('password', "Password must be at least 6 characters long").exists().custom(value => value.length > 3),
    check('username', 'Username exists try another').exists().custom(async value => {
        if (value && value.length > 0) {
            return !await UserService.findByEmail(value);
        }
        return false;
    }),
];

module.exports = {registerValidator};

