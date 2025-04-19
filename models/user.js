const mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
    username : {type: String, unique: true, sparse: true},
    passwordHash: String,   // for propietary account
    googleId: String,       // for passport google login
    displayName: String, 
});

var userModel = mongoose.model('User', userSchema)

module.exports = userModel