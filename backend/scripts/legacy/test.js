const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });

const endpoints = [
    '/api/auth/me',
    '/api/dashboard/stats',
    '/api/contacts',
    '/api/groups',
    '/api/campaigns',
    '/api/schedule',
    '/api/automations/projects'
];

async function run() {
    for (let ep of endpoints) {
        try {
            let res = await fetch(`http://localhost:5000${ep}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) {
                let data = await res.text();
                console.log(`❌ ${ep} - ${res.status} - ${data}`);
            } else {
                console.log(`✅ ${ep} - 200 OK`);
            }
        } catch (e) {
            console.log(`❌ ${ep} - Network Error - ${e.message}`);
        }
    }
}
run();
