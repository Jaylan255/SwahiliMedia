import { writeFile } from 'node:fs/promises';

const SITE_URL = (process.env.SITE_URL || 'https://www.swamedia.online').replace(/\/$/, '');
const DB_URL = (process.env.FIREBASE_DB_URL || 'https://swamediaweb-default-rtdb.firebaseio.com').replace(/\/$/, '');
const BUILD_DATE = new Date().toISOString().slice(0, 10);

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const toLastMod = (value) => {
  const timestamp = Number(value || 0);
  if (!timestamp || !Number.isFinite(timestamp)) return BUILD_DATE;
  return new Date(timestamp).toISOString().slice(0, 10);
};

const fetchJson = async (path) => {
  try {
    const response = await fetch(`${DB_URL}/${path}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Skipping ${path}: ${error.message}`);
    return {};
  }
};

const coreUrls = [
  '/',
  '/search',
  '/series',
  '/storyzone',
  '/payment',
  '/app',
  '/free',
  '/install/android',
  '/install/ios',
  '/install/desktop',
  '/feedback',
  '/help',
  '/about-us',
  '/privacy-policy',
  '/disclaimer'
].map((path) => ({ loc: `${SITE_URL}${path}`, lastmod: BUILD_DATE, images: [] }));

const mapContentUrls = (items = {}, type = 'movie') => Object.entries(items || {})
  .filter(([, value]) => value && value.isPublished !== false)
  .map(([id, value]) => {
    const slugMap = {
      movie: 'movie',
      series: 'series-show',
      adult: 'adult',
      connection: 'connection',
      xxx: 'viral'
    };
    return {
      loc: `${SITE_URL}/${slugMap[type] || type}/${encodeURIComponent(id)}`,
      lastmod: toLastMod(value.updatedAt || value.createdAt || value.timestamp),
      images: value.posterUrl ? [value.posterUrl] : []
    };
  });

const mapStoryUrls = (items = {}) => Object.entries(items || {})
  .filter(([, value]) => value && value.isPublished !== false)
  .map(([id, value]) => ({
    loc: `${SITE_URL}/story/${encodeURIComponent(id)}`,
    lastmod: toLastMod(value.updatedAt || value.timestamp),
    images: value?.posterUrl ? [value.posterUrl] : []
  }));

const mapTaxonomyUrls = (items = {}, route = 'genre') => Object.entries(items || {})
  .map(([, value]) => String(value?.name || value?.title || value?.value || '').trim())
  .filter(Boolean)
  .map((name) => ({
    loc: `${SITE_URL}/${route}/${encodeURIComponent(name)}`,
    lastmod: BUILD_DATE,
    images: []
  }));

const buildUrlNode = ({ loc, lastmod, images = [] }) => {
  const imageNodes = images.map((image) => `
    <image:image>
      <image:loc>${escapeXml(image)}</image:loc>
    </image:image>`).join('');
  return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>${imageNodes}
  </url>`;
};

const uniqueByLoc = (urls = []) => [...new Map(urls.map((url) => [url.loc, url])).values()];

const main = async () => {
  const [movies, series, adultContent, connection, xxx, stories, categories, djGenres] = await Promise.all([
    fetchJson('movies'),
    fetchJson('series'),
    fetchJson('adultContent'),
    fetchJson('connection'),
    fetchJson('xxx'),
    fetchJson('stories'),
    fetchJson('categories'),
    fetchJson('djgenres')
  ]);

  const urls = uniqueByLoc([
    ...coreUrls,
    ...mapContentUrls(movies, 'movie'),
    ...mapContentUrls(series, 'series'),
    ...mapContentUrls(adultContent, 'adult'),
    ...mapContentUrls(connection, 'connection'),
    ...mapContentUrls(xxx, 'xxx'),
    ...mapStoryUrls(stories),
    ...mapTaxonomyUrls(categories, 'genre'),
    ...mapTaxonomyUrls(djGenres, 'dj')
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.map(buildUrlNode).join('')}
</urlset>
`;

  await writeFile(new URL('../sitemap.xml', import.meta.url), xml, 'utf8');

  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /security/
Disallow: /storage/
Disallow: /*.log$
Disallow: /*.sql$

Sitemap: ${SITE_URL}/sitemap.xml
`;

  await writeFile(new URL('../robots.txt', import.meta.url), robotsTxt, 'utf8');
  console.log(`Generated sitemap with ${urls.length} URLs and refreshed robots.txt`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
