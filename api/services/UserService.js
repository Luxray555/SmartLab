const User = require('../models/User');

class UserService {
    static async create(username, password) {
        const user = new User({ username, password });
        await user.save(); // ← token généré automatiquement
        return { token: user.token };
    }

    static async login(username, password) {
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            throw new Error('Invalid credentials');
        }

        // Regénère un token à chaque connexion
        user.token = require('crypto').randomBytes(32).toString('hex');
        await user.save();

        return { token: user.token };
    }


    static async validateToken(token) {
        const user = await User.findOne({ token });
        return !!user;
    }

    static async findByToken(token) {
        const user = await User.findOne({ token }).lean();
        if (!user) throw new Error('Invalid token');
        return user;
    }
}

module.exports = UserService;