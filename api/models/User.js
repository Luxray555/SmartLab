const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    token: { type: String, unique: true, sparse: true }
});

// Hash password and generate token before saving
UserSchema.pre('save', async function() {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    if (!this.token) {
        this.token = require('crypto').randomBytes(32).toString('hex');
    }
});

// Compare password with hashed version
UserSchema.methods.comparePassword = async function(pwd) {
    return await bcrypt.compare(pwd, this.password);
};

module.exports = mongoose.model('User', UserSchema);