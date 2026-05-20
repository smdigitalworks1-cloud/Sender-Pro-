const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// Determine dialect: default to mysql if DB_NAME is set, else sqlite
const dialect = process.env.DB_DIALECT || (process.env.DB_NAME ? 'mysql' : 'sqlite');
const isMySQL = dialect === 'mysql';

const sequelize = new Sequelize(
    process.env.DB_NAME || 'sender_pro',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        dialect: dialect,
        storage: !isMySQL ? path.join(__dirname, '..', 'sender_pro.sqlite') : undefined,
        logging: false,
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        },
        dialectOptions: isMySQL ? {
            charset: 'utf8mb4'
        } : {}
    }
);

module.exports = sequelize;
