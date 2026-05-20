const fs = require('fs');
const path = require('path');

const filesToParse = [
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

    // Fix .destroy({ id: ... }) to .destroy({ where: { id: ... } })
    // We can just use String replace with a regex that looks for .destroy({
    // and checks if it's already { where: {
    code = code.replace(/\.destroy\(\{\s*(?!where:)/g, '.destroy({ where: { ');

    // Also fix missing closing braces for `where`: where: { id... } becomes where: { id... } }
    // Since we replaced `.destroy({` with `.destroy({ where: {`, we added an opening brace.
    // We need to add a closing brace before `})`.
    // Wait, so we can do:
    // .replace(/\.destroy\(\{ where: \{([^)]+)\}\)/g, '.destroy({ where: {$1} })')
    // No, actually replace .destroy({ ... }) -> .destroy({ where: { ... } }) by replacing .destroy( and wrapping the argument!
    // It's much easier to write a custom string parser or regex.
    // The simplest regex:
    code = code.replace(/\.destroy\(([\s\S]*?)\)/g, (match, p1) => {
        if (p1.includes('where:')) return match; // already fixed
        if (p1.trim() === '') return match;
        return `.destroy({ where: ${p1} })`;
    });

    fs.writeFileSync(p, code);
});
console.log('Done wrapping destroy queries.');
