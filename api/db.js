const mongoose = require('mongoose');

// Connect to MongoDB database
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/smartlab', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;