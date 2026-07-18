const fs = require('fs');

const workerFile = 'src/index.js';
const htmlFile = 'index.html';

let worker = fs.readFileSync(workerFile, 'utf8');
let html = fs.readFileSync(htmlFile, 'utf8');

/* FIX WORKER ROUTE */
if (!worker.includes('const handleOfficialMediaRefresh')) {
  throw new Error('handleOfficialMediaRefresh haipo kwenye src/index.js');
}

/* Ondoa route yoyote iliyowekwa sehemu isiyo sahihi */
worker = worker.replace(
  /\n\s*if\s*\(url\.pathname\s*===\s*["']\/api\/media-url["']\)\s*\{\s*return\s+handleOfficialMediaRefresh\(request,\s*env\);\s*\}\s*/g,
  '\n'
);

const exportPos = worker.indexOf('export default {');
const fetchPos = worker.indexOf('async fetch', exportPos);
const urlMarker = 'const url = new URL(request.url);';
const urlPos = worker.indexOf(urlMarker, fetchPos);

if (exportPos < 0 || fetchPos < 0 || urlPos < 0) {
  throw new Error('Main Worker fetch haijaonekana');
}

worker =
  worker.slice(0, urlPos + urlMarker.length) +
  `

    if (url.pathname === "/api/media-url") {
      return handleOfficialMediaRefresh(request, env);
    }` +
  worker.slice(urlPos + urlMarker.length);

fs.writeFileSync(workerFile, worker);

/* ADD FRONTEND FRESH URL HELPER */
if (!html.includes('const fetchFreshMediaUrl = async')) {
  const helperMarker = '        const handleBack = () => {';

  if (!html.includes(helperMarker)) {
    throw new Error('handleBack marker haijaonekana kwenye index.html');
  }

  const helper = `
        const identifyMediaProvider = (item = {}) => {
            const source = String(
                item.source ||
                item.source_name ||
                item.sourceName ||
                item.source_site ||
                item.sourceSite ||
                ''
            ).toLowerCase();

            const recordId = String(
                item.source_id ||
                item.sourceId ||
                item.castillaId ||
                item.parentId ||
                item.id ||
                ''
            ).trim();

            let provider = '';

            if (source.includes('swahilicinema') || /^swahilicinema_/i.test(recordId)) {
                provider = 'swahilicinema';
            } else if (source.includes('castilla') || /^castilla_/i.test(recordId)) {
                provider = 'castilla';
            }

            const sourceId = recordId
                .replace(/^castilla_/i, '')
                .replace(/^swahilicinema_/i, '');

            return { provider, sourceId };
        };

        const fetchFreshMediaUrl = async (item = {}, action = 'stream') => {
            const { provider, sourceId } = identifyMediaProvider(item);

            if (!provider || !sourceId) return '';

            const endpoint = new URL('/api/media-url', window.location.origin);
            endpoint.searchParams.set('provider', provider);
            endpoint.searchParams.set('source_id', sourceId);
            endpoint.searchParams.set(
                'action',
                action === 'download' ? 'download' : 'stream'
            );
            endpoint.searchParams.set('_fresh', Date.now().toString());

            const episodeNumber = Number(
                item.episodeNumber ||
                item.episode_number ||
                item.episode ||
                0
            );

            if (episodeNumber > 0) {
                endpoint.searchParams.set('episode', String(episodeNumber));
            }

            if (item.partKey) {
                endpoint.searchParams.set('part', String(item.partKey));
            }

            const headers = {
                Accept: 'application/json',
                'Cache-Control': 'no-cache'
            };

            if (currentUser && typeof currentUser.getIdToken === 'function') {
                headers.Authorization = \`Bearer \${await currentUser.getIdToken(true)}\`;
            }

            const response = await fetch(endpoint.toString(), {
                method: 'GET',
                headers,
                cache: 'no-store',
                credentials: 'same-origin'
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.url) {
                throw new Error(
                    result.error ||
                    \`Fresh media URL request failed (\${response.status})\`
                );
            }

            return result.url;
        };

`;

  html = html.replace(helperMarker, helper + helperMarker);
}

/* FIX WATCH BUTTON */
html = html.replace(
  /if \(!promptForProtectedAccess\(resolvedPlaybackItem, 'watch'\)\) return;\s*await navigateTo\(`watchFullscreen:\$\{watchId\}`\);/,
  `if (!promptForProtectedAccess(resolvedPlaybackItem, 'watch')) return;

                const watchMediaContext = {
                    ...(parentContent || {}),
                    ...payload,
                    id: parentId,
                    parentId
                };

                const watchProvider = identifyMediaProvider(watchMediaContext);

                if (watchProvider.provider) {
                    try {
                        const freshWatchUrl = await fetchFreshMediaUrl(
                            watchMediaContext,
                            'stream'
                        );

                        if (freshWatchUrl) {
                            payload.watchUrl = freshWatchUrl;
                            payload.videoUrl = freshWatchUrl;
                            storeWatchPagePayload(payload);
                        }
                    } catch (error) {
                        console.error('Fresh Watch URL error:', error);
                        showNotification(
                            error.message || 'Watch link mpya haijapatikana.',
                            'error'
                        );
                        return;
                    }
                }

                await navigateTo(\`watchFullscreen:\${watchId}\`);`
);

/* FIX WATCH PAGE DOWNLOAD BUTTON */
const downloadStart =
  "            const watchDownloadBtn = document.getElementById('watch-download-btn');";

const downloadEnd =
  "            const watchDetailsBtn = document.getElementById('watch-details-btn');";

const startPos = html.indexOf(downloadStart);
const endPos = html.indexOf(downloadEnd, startPos);

if (startPos < 0 || endPos < 0) {
  throw new Error('watchDownloadBtn block haijaonekana');
}

const newDownloadBlock = `            const watchDownloadBtn = document.getElementById('watch-download-btn');
            if (watchDownloadBtn) watchDownloadBtn.addEventListener('click', async () => {
                if (!promptForProtectedAccess(resolvedPlaybackItem, 'download')) return;

                const downloadMediaContext = {
                    ...(parentContent || {}),
                    ...payload,
                    id: parentId,
                    parentId
                };

                let resolvedDownloadUrl = downloadUrl;
                const downloadProvider = identifyMediaProvider(downloadMediaContext);

                if (downloadProvider.provider) {
                    try {
                        resolvedDownloadUrl = await fetchFreshMediaUrl(
                            downloadMediaContext,
                            'download'
                        );
                    } catch (error) {
                        console.error('Fresh Download URL error:', error);
                        showNotification(
                            error.message || 'Download link mpya haijapatikana.',
                            'error'
                        );
                        return;
                    }
                }

                if (!resolvedDownloadUrl) {
                    showNotification('Download link haipatikani.', 'error');
                    return;
                }

                const directDownloadUrl =
                    getGoogleDriveUrls(resolvedDownloadUrl).downloadUrl ||
                    resolvedDownloadUrl;

                triggerDirectDownload(
                    directDownloadUrl,
                    \`\${String(contentTitle || 'swamedia-download').replace(/[^\\w.-]+/g, '_')}\`,
                    {
                        parentId,
                        parentType,
                        parentTitle,
                        title: contentTitle,
                        posterUrl: payload.posterUrl || '',
                        sourceId: payload.sourceId || payload.source_id || '',
                        sourceType: payload.sourceType || parentType,
                        seasonNumber: payload.seasonNumber || 0,
                        episodeNumber: payload.episodeNumber || 0
                    }
                );
            });
`;

html =
  html.slice(0, startPos) +
  newDownloadBlock +
  html.slice(endPos);

fs.writeFileSync(htmlFile, html);

console.log('FRESH MEDIA ROUTE, WATCH NA DOWNLOAD ZIMEUNGANISHWA');
