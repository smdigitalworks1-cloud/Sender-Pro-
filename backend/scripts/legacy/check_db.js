const { User, SuperAdmin } = require('./models');
async function check() {
    const users = await User.findAll({ attributes: ['id', 'email', 'parentId', 'subStatus', 'isAdmin'] });
    const admins = await SuperAdmin.findAll({ attributes: ['id', 'email'] });
    console.log('USERS:', JSON.stringify(users, null, 2));
    console.log('SUPERADMINS:', JSON.stringify(admins, null, 2));
    process.exit();
}
check();
