const mongoose = require('mongoose');
require('dotenv').config({ override: true });

const connectDB = async () => {
    // If already connected, return connection immediately
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // If currently connecting, wait until it is fully connected or fails
    if (mongoose.connection.readyState === 2) {
        console.log("⏳ MongoDB is currently connecting. Awaiting connection open event...");
        await new Promise((resolve, reject) => {
            const onOpen = () => {
                cleanup();
                resolve();
            };
            const onError = (err) => {
                cleanup();
                reject(err);
            };
            const cleanup = () => {
                mongoose.connection.removeListener('open', onOpen);
                mongoose.connection.removeListener('error', onError);
            };
            mongoose.connection.once('open', onOpen);
            mongoose.connection.once('error', onError);
        });
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
