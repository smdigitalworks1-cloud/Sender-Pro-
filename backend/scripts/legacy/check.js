require('dotenv').config();
const { SuperAdmin } = require('./models');

async function checkAdmin() {
    const admin = await SuperAdmin.findOne({ where: { email: 'smdigitalworks1@gmail.com' } });
    if (admin) {
        console.log("Found admin:", admin.email);
        const m1 = await admin.matchPassword('smdigitalworks');
        console.log("Password matches 'smdigitalworks':", m1);
    } else {
        console.log("No superadmin found.");
    }
    process.exit();
}
checkAdmin();
