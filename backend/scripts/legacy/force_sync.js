require('dotenv').config();
const { User, Subscription } = require('./models');
const syncToSheets = require('./utils/syncSheets');
const syncPayments = require('./utils/syncPayments');

async function pushEveryone() {
    console.log("Fetching all users from database...");
    try {
        const users = await User.findAll();
        let userCount = 0;
        for (const u of users) {
            // Because we just added the `role` column, older users might have 'user' by default.
            // Let's ensure the `role` is correctly populated based on legacy fields before syncing:
            if (!u.role || u.role === 'user') {
                if (u.parentId !== null) {
                    u.role = 'subaccount';
                    await u.save();
                } else if (u.isAdmin) {
                    u.role = 'admin';
                    await u.save();
                } else if (u.email === 'smdigitalworks1@gmail.com') {
                    // special case
                    u.role = 'superadmin';
                    await u.save();
                }
            }

            await syncToSheets(u);
            userCount++;
            await new Promise(r => setTimeout(r, 500)); // slight delay to prevent hitting App Script limits
        }

        console.log("Fetching all payments from database...");
        const payments = await Subscription.findAll({
            include: [{ model: User, attributes: ['name', 'email', 'whatsappNumber'] }],
            where: { status: 'paid' }
        });

        let paymentCount = 0;
        for (const p of payments) {
            if (p.User) {
                await syncPayments({
                    userId: p.userId,
                    name: p.User.name,
                    email: p.User.email,
                    whatsappNumber: p.User.whatsappNumber,
                    plan: p.plan,
                    amount: p.amount,
                    status: p.status,
                    paymentId: p.razorpayPaymentId || 'N/A',
                    paymentDate: new Date(p.createdAt).toLocaleString(),
                });
                paymentCount++;
                await new Promise(r => setTimeout(r, 500));
            }
        }

        console.log(`✅ Successfully synced ${userCount} users/sub-accounts and ${paymentCount} payments individually!`);
        process.exit(0);
    } catch (err) {
        console.error("Error during manual sync:", err);
        process.exit(1);
    }
}

pushEveryone();
