const fs = require("fs");

const file = "index.html";
let html = fs.readFileSync(file, "utf8");

const helperMarker =
  "        const getContentCollectionConfig = (contentTypeOrPath = '') => {";

const helper = `        const proxyExternalPosterUrl = (posterUrl = '') => {
            const rawUrl = String(posterUrl || '').trim();
            if (!rawUrl) return '';

            try {
                const parsed = new URL(rawUrl);
                const allowedHosts = new Set([
                    'castillabizz.com',
                    'www.castillabizz.com',
                    'swahilicinema.com',
                    'www.swahilicinema.com',
                    's3.ap-southeast-1.wasabisys.com',
                    's3.eu-central-2.wasabisys.com'
                ]);

                return allowedHosts.has(parsed.hostname.toLowerCase())
                    ? '/api/image-proxy?url=' + encodeURIComponent(rawUrl)
                    : rawUrl;
            } catch {
                return rawUrl;
            }
        };

`;

if (!html.includes("const proxyExternalPosterUrl")) {
  if (!html.includes(helperMarker)) {
    throw new Error("Content helper marker haijaonekana");
  }

  html = html.replace(helperMarker, helper + helperMarker);
}

if (!html.includes("posterUrl: proxyExternalPosterUrl(item.posterUrl)")) {
  const mapPattern =
    /(\bconst items = transformSnapshotToArray\(snapshot\)\.map\(item => \(\{\s*\n\s*\.\.\.item,\s*\n)(\s*type: normalizeContentType)/;

  if (!mapPattern.test(html)) {
    throw new Error("Content mapping marker haijaonekana");
  }

  html = html.replace(
    mapPattern,
    "$1                    posterUrl: proxyExternalPosterUrl(item.posterUrl),\n$2"
  );
}

fs.writeFileSync(file, html);
console.log("Poster proxy imeongezwa.");
