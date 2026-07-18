const fs = require('fs');

const file = 'src/index.js';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('const handleOfficialMediaRefresh')) {
  throw new Error('handleOfficialMediaRefresh haipo kwenye src/index.js');
}

/* Ondoa route iliyowekwa sehemu isiyo sahihi */
code = code.replace(
  /\n\s*if\s*\(url\.pathname\s*===\s*["']\/api\/media-url["']\)\s*\{\s*return\s+handleOfficialMediaRefresh\(request,\s*env\);\s*\}/g,
  ''
);

code = code.replace(
  /\n\s*if\s*\(url\.pathname\s*===\s*["']\/api\/debug-version["']\)[\s\S]*?;\s*\}/g,
  ''
);

const exportPos = code.indexOf('export default {');
const fetchPos = code.indexOf('async fetch(', exportPos);
const marker = 'const url = new URL(request.url);';
const urlPos = code.indexOf(marker, fetchPos);

if (exportPos < 0 || fetchPos < 0 || urlPos < 0) {
  throw new Error('Main Worker fetch au URL marker haijaonekana');
}

const routes = `

    if (url.pathname === "/api/debug-version") {
      return new Response(JSON.stringify({
        ok: true,
        mediaRoute: true,
        version: "media-route-v2"
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/api/media-url") {
      return handleOfficialMediaRefresh(request, env);
    }`;

code =
  code.slice(0, urlPos + marker.length) +
  routes +
  code.slice(urlPos + marker.length);

fs.writeFileSync(file, code);
console.log('MEDIA ROUTE IMEWEKWA KWENYE MAIN FETCH');
