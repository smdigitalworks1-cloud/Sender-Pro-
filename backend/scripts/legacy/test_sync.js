require('dotenv').config();
const syncSheets = require('./utils/syncSheets');
const syncPayments = require('./utils/syncPayments');

async function test() {
    console.log("Testing sync to Sub Acc...");
    const mockSubAcc = {
        id: 101,
        name: "Test Sub Acc",
        email: "testsub@example.com",
        role: "User",
        subStatus: "active",
        subExpiry: new Date(),
        createdAt: new Date(),
        whatsappNumber: "1234567890",
        parentId: 1 // sets it to Sub Acc
    };

    // syncSheets needs a mock for User.findByPk to get parent
    // but in syncSheets.js:
    // const { User } = require('../models');
    // const parent = await User.findByPk(user.parentId);
    // Let's just mock the HTTP request that it sends.

    const axios = require('axios');
    const scriptUrl = process.env.GOOGLE_SHEETS_SYNC_URL;

    if (!scriptUrl) {
        console.log("No script URL!");
        return;
    }

    try {
        console.log("Sending Sub Acc data...");
        let res = await axios.post(scriptUrl, {
            action: 'upsertUser',
            sheetName: 'Sub Acc',
            userData: {
                id: mockSubAcc.id,
                name: mockSubAcc.name,
                email: mockSubAcc.email,
                role: mockSubAcc.role,
                subStatus: mockSubAcc.subStatus,
                subExpiry: mockSubAcc.subExpiry,
                createdAt: mockSubAcc.createdAt,
                whatsappNumber: mockSubAcc.whatsappNumber,
                managedBy: 'Test Admin (admin@test.com)'
            }
        });
        console.log("Sub Acc Response:", res.data);
    } catch (e) {
        console.error("Sub Acc Error:", e.response ? e.response.data : e.message);
    }

    try {
        console.log("Sending Payment details data...");
        let res = await axios.post(scriptUrl, {
            action: 'upsertUser',
            sheetName: 'Payment details',
            userData: {
                id: 101,
                name: "Test Payment",
                email: "testsub@example.com",
                phone: "1234567890",
                plan: "user_monthly",
                amount: 10000,
                paymentId: "pay_12345",
                paymentDate: new Date().toLocaleString(),
                status: "paid"
            }
        });
        console.log("Payment detail Response:", res.data);
    } catch (e) {
        console.error("Payment Error:", e.response ? e.response.data : e.message);
    }
}

test();
