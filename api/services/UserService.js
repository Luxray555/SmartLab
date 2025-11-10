const User = require('../models/User');

class UserService {
    static async create(username, password) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            throw new Error('Un utilisateur avec ce nom existe déjà');
        }
        const user = new User({ username, password });
        await user.save();
        return { token: user.token };
    }

    static async login(username, password) {
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            throw new Error('Nom d\'utilisateur ou mot de passe incorrect');
        }

        user.token = require('crypto').randomBytes(32).toString('hex');
        await user.save();

        return { token: user.token };
    }


    static async validateToken(token) {
        const user = await User.findOne({ token });
        return !!user;
    }

    static async invalidateToken(token) {
        await User.updateOne({ token }, { $unset: { token: 1 } });
    }

    static async findByToken(token) {
        const user = await User.findOne({ token }).lean();
        if (!user) throw new Error('Invalid token');
        return user;
    }
}

module.exports = UserService;