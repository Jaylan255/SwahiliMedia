const fs = require('fs');
const contentPath = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\89c9d8e7-57bf-46fc-b817-157d1c66efe7\\.system_generated\\steps\\15\\content.md';
const fileContent = fs.readFileSync(contentPath, 'utf8');

const jsonStart = fileContent.indexOf('---') + 3;
const jsonStr = fileContent.substring(jsonStart).trim();

try {
    const data = JSON.parse(jsonStr);
    const routes = Object.keys(data.routes);
    
    const matchedRoutes = routes.filter(r => {
        const lower = r.toLowerCase();
        return lower.includes('movie') || 
               lower.includes('video') || 
               lower.includes('tvshow') || 
               lower.includes('show') || 
               lower.includes('series') || 
               lower.includes('episode');
    });

    console.log('Matched routes count:', matchedRoutes.length);
    console.log('Matched routes:', matchedRoutes);
} catch (e) {
    console.error('Parsing error:', e);
}
