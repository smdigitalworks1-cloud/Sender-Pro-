const fs = require('fs');
const path = require('path');

const authPath = path.join(__dirname, '.wwebjs_auth');
if (fs.existsSync(authPath)) {
    console.log('🗑️  Removing corrupted session data...');
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('✅ Session data removed successfully. You can now run "npm start".');
} else {
    console.log('✅ No session data found. You are good to run "npm start".');
}
