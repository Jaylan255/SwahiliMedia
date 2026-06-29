const fs = require('fs');
const contentPath = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\89c9d8e7-57bf-46fc-b817-157d1c66efe7\\.system_generated\\steps\\210\\content.md';
const fileContent = fs.readFileSync(contentPath, 'utf8');

const lines = fileContent.split('\n');
const matchingLines = [];
lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (lower.includes('season') || lower.includes('episode') || lower.includes('bunny-wp-pullzone') || lower.includes('.mp4') || lower.includes('download')) {
        matchingLines.push(`${idx + 1}: ${line.trim()}`);
    }
});

console.log('Matches for TV show:');
console.log(matchingLines.slice(0, 100).join('\n'));
