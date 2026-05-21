const mongoose = require('mongoose');
require('dotenv').config({ override: true });

const connectDB = async () => {
    // If already connected or connecting, return connection
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        return mongoose.connection;
    }

    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/sender_pro';
        const maskedURI = mongoURI.replace(/:([^@]+)@/, ':****@');
        console.log(`📡 Connecting to MongoDB: ${maskedURI}`);
        
        const conn = await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000 // 5 seconds timeout
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
        throw error;
    }
};

module.exports = connectDB;
