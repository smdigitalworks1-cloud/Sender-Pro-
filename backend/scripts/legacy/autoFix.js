const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

    let passes = false;
    let attempts = 0;
    while (!passes && attempts < 30) {
        attempts++;
        try {
            execSync(`node -c ${p}`);
            passes = true;
            console.log(`Passed ${file}`);
        } catch (err) {
            const match = err.stderr && err.stderr.toString().match(/.js:(\d+)/);
            if (match) {
                const lineNo = parseInt(match[1], 10) - 1;
                let lines = fs.readFileSync(p, 'utf8').split('\n');
                let line = lines[lineNo];
                console.log(`Fixing ${file}:${lineNo + 1} -> ${line}`);

                // Count { and } inside the line. If { > }, append }
                let openBraces = (line.match(/\{/g) || []).length;
                let closeBraces = (line.match(/\}/g) || []).length;

                if (openBraces > closeBraces) {
                    // we are missing } before );
                    line = line.replace(');', '});').replace(')', '})');
                } else if (line.includes('} })')) {
                    line = line.replace('} })', '})');
                }

                lines[lineNo] = line;
                fs.writeFileSync(p, lines.join('\n'));
            } else {
                break;
            }
        }
    }
});
