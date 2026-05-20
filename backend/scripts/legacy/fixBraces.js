const fs = require('fs');
const path = require('path');

const filesToParse = [
    'routes/auth.js',
    'routes/automations.js',
    'routes/autoreply.js',
    'routes/campaigns.js',
    'routes/contacts.js',
    'routes/dashboard.js',
    'routes/globalVars.js',
    'routes/groups.js',
    'routes/schedule.js',
    'routes/upload.js',
    'utils/automationEngine.js'
];

filesToParse.forEach(file => {
    const p = path.join(__dirname, file);
    if (!fs.existsSync(p)) return;
    let code = fs.readFileSync(p, 'utf8');

    // Fix up duplicate where: { where: {
    code = code.replace(/\{ where: \{ where: \{/g, '{ where: {');

    // Any line having `.findAll({ where: { something })` without closing the where
    // Let's just find exactly `{ where: {` and missing `}`
    // Easier to just find `})` that comes after `{ where: {` and replace it
    // I will just revert to Mongoose format so we can use AST logic later :
    code = code.replace(/\.findAll\(\{ where: \{/g, '.findAll({');
    code = code.replace(/\.findOne\(\{ where: \{/g, '.findOne({');
    code = code.replace(/\.count\(\{ where: \{/g, '.count({');
    code = code.replace(/\.destroy\(\{ where: \{/g, '.destroy({');

    fs.writeFileSync(p, code);
});
console.log('Done reverting brace hacks.');
