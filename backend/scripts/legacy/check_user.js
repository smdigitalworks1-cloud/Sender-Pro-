const { User } = require('./models');

async function run() {
    const user = await User.findOne({ where: { email: 'sathi19112003@gmail.com' } });
    if (!user) {
        console.log("USER NOT FOUND");
    } else {
        console.log("USER JSON:", user.toJSON());
        console.log("USER ROLE:", user.role);
        console.log("IS ACTIVE SUBSCRIPTION:", user.hasActiveSubscription());
    }
    process.exit(0);
}
run();
