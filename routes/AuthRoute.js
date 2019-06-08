const authRoute = require("express").Router();
const AuthController = require("../controller/AuthController");
const ValidationResult = require("../helpers/ValidationResult");
const {registerValidator} = require("../validator/authValidator");
const ValidateToken = require("../middlewares/ValidateToken");

authRoute.post('/auth/register', registerValidator, ValidationResult, AuthController.register);
authRoute.post('/auth/login', ValidationResult, AuthController.login);
authRoute.post('/auth/init-session', AuthController.initSession);
authRoute.post('/auth/logout', ValidateToken(), AuthController.logout);

module.exports = authRoute;
