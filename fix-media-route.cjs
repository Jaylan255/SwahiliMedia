const fs = require('fs');

const file = 'src/index.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /\n\s*if\s*\(url\.pathname\s*===\s*["']\/api\/media-url["']\)\s*\{\s*return\s+handleOfficialMediaRefresh\(request,\s*env\);\s*\}\s*/g,
  '\n'
);

const exportPosition = code.indexOf('export default {');
const fetchPosition = code.indexOf('async fetch', exportPosition);
const marker = 'const url = new URL(request.url);';
const urlPosition = code.indexOf(marker, fetchPosition);

if (exportPosition < 0 || fetchPosition < 0 || urlPosition < 0) {
  throw new Error('Main Worker fetch haijaonekana.');
}

const replacement = `const url = new URL(request.url);

    if (url.pathname === "/api/media-url") {
      return handleOfficialMediaRefresh(request, env);
    }`;

code =
  code.slice(0, urlPosition) +
  replacement +
  code.slice(urlPosition + marker.length);

fs.writeFileSync(file, code);
console.log('MEDIA ROUTE IMEWEKWA KWENYE MAIN WORKER FETCH');
