const fs = require('fs');
const path = require('path');

const directory = './indicator';

const files = [
    'utils.pine',
    'config.pine',
    'ema.pine',
    'pivot_points.pine',
    'market_sessions.pine',
    'psy_levels.pine',
    'vector_candles.pine',
    'adr_awr_amr.pine',
    'alerts.pine'
];

let mergedContent = '';

files.forEach(file => {
    const filePath = path.join(directory, file);
    const content = fs.readFileSync(filePath, 'utf8');
    mergedContent += content + '\n';
});

fs.writeFileSync('trader7_indicator.pine', mergedContent);
console.log('Files merged successfully into merged_script.pine');