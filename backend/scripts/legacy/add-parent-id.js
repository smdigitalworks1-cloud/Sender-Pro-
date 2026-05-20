require('dotenv').config();
const { sequelize } = require('./models/index.js');

async function fixDb() {
    try {
        await sequelize.authenticate();
        const query = "ALTER TABLE Users ADD COLUMN parentId INT DEFAULT NULL;";
        try {
            await sequelize.query(query);
            console.log(`Executed: ${query}`);
        } catch (err) {
            if (err.message.includes('Duplicate column name')) {
                console.log(`Column already exists: parentId`);
            } else {
                console.error(`Error:`, err.message);
            }
        }
    } catch (err) { }
    process.exit();
}
fixDb();
