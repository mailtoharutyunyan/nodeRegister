const User = require('../model/User');

class UserService {

    static async getAllUsers(callback) {
        try {
            const users = await User.find();
            callback.onSuccess(users);
            return users;
        } catch (e) {
            console.log("error");
        }
    }



    static async findByEmail(value) {
        try {
            return await User.findOne({username: value});
        } catch (e) {
            console.log(e)
        }
    }

}

module.exports = UserService;