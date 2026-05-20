const { User, SuperAdmin } = require('./models');
(async () => {
    try {
        const u = await User.findOne({ where: { email: 'sathiyans2003@gmail.com' } });
        console.log('User:', u?.toJSON());
        const s = await SuperAdmin.findOne({ where: { email: 'sathiyans2003@gmail.com' } });
        console.log('Super:', s?.toJSON());
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
})();
