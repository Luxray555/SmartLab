const User = require('../models/User');

class UserService {
    // Create a new user
    static async create(username, password) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            throw new Error('A user with this name already exists');
        }
        const user = new User({ username, password });
        await user.save();
        return { token: user.token };
    }

    // Authenticate user and generate new token
    static async login(username, password) {
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            throw new Error('Invalid username or password');
        }

        user.token = require('crypto').randomBytes(32).toString('hex');
        await user.save();

        return { token: user.token };
    }

    // Check if token is valid
    static async validateToken(token) {
        const user = await User.findOne({ token });
        return !!user;
    }

    // Invalidate user token (logout)
    static async invalidateToken(token) {
        await User.updateOne({ token }, { $unset: { token: 1 } });
    }

    // Find user by token
    static async findByToken(token) {
        const user = await User.findOne({ token }).lean();
        if (!user) throw new Error('Invalid token');
        return user;
    }

    // Find user by username
    static async findByUsername(username) {
        const user = await User.findOne({ username });
        return user;
    }

    // Generate a new token for a user
    static async generateToken(username) {
        const user = await this.findByUsername(username);
        if (!user) throw new Error('User not found');
        const token = require('crypto').randomBytes(32).toString('hex');
        user.token = token;
        user.tokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
        await user.save();
        return token;
    }
}

module.exports = UserService;