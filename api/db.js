const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/projet3', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connecté');
    } catch (err) {
        console.error('MongoDB erreur:', err);
        process.exit(1);
    }
};

module.exports = connectDB;