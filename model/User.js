const mongoose = require("mongoose");

const UserSchema = mongoose.Schema({
    name: {type: String},
    username: {type: String, unique: true, required: true, dropDups: true},
    email: {type: String},
    password: {type: String, required: true},
    temp_password: {type: String},
    profile_picture: {type: String},
    phone: {type: String},
    address: {type: String},
    status: {type: Number, default: 0},
    isDisabled: {type: Boolean, default: false}
}, {versionKey: false, timestamps: true});


const User = mongoose.model('User', UserSchema);

module.exports = User;
