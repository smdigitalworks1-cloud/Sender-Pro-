require('dotenv').config();
const { sequelize } = require('./models/index.js');

async function fixDb() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB...');

        const queries = [
            "ALTER TABLE SuperAdmins ADD COLUMN resetPasswordToken VARCHAR(255);",
            "ALTER TABLE SuperAdmins ADD COLUMN resetPasswordExpire DATETIME;"
        ];

        for (const query of queries) {
            try {
                await sequelize.query(query);
                console.log(`Executed: ${query}`);
            } catch (err) {
                if (err.message.includes('Duplicate column name')) {
                    console.log(`Column already exists: ${query.split('ADD COLUMN ')[1]}`);
                } else {
                    console.error(`Error on query ${query}:`, err.message);
                }
            }
        }

        console.log('✅ Database patch complete for SuperAdmins.');
    } catch (err) {
        console.error('Database patch failed:', err);
    } finally {
        process.exit();
    }
}

fixDb();
