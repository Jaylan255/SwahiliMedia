import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

const staticFiles = [
  '_headers',
  '_redirects',
  'firebase-messaging-sw.js',
  'index.html',
  'manifest.json',
  'offline.html',
  'robots.txt',
  'sitemap.xml'
];

const staticDirs = [
  'admin',
  'icons',
  'subscriptions'
];

const extraFiles = [
  'security/content-protection.js'
];

const distAssetsIgnore = `# Generated deploy output. Keep Cloudflare Workers assets small.
node_modules/
**/node_modules/
.git/
.wrangler/
.env
.env.*
*.php
*.log
`;

const ensureInsideRoot = (targetPath) => {
  const relativePath = path.relative(rootDir, targetPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside project root: ${targetPath}`);
  }
};

const copyFileToDist = async (relativePath) => {
  const source = path.join(rootDir, relativePath);
  const destination = path.join(distDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
};

const copyDirToDist = async (relativePath) => {
  const source = path.join(rootDir, relativePath);
  const destination = path.join(distDir, relativePath);
  await cp(source, destination, {
    recursive: true,
    filter: (sourcePath) => !sourcePath.endsWith('.htaccess')
  });
};

ensureInsideRoot(distDir);
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const file of staticFiles) {
  await copyFileToDist(file);
}

for (const dir of staticDirs) {
  await copyDirToDist(dir);
}

for (const file of extraFiles) {
  await copyFileToDist(file);
}

await writeFile(path.join(distDir, '.assetsignore'), distAssetsIgnore);

console.log('Cloudflare assets prepared in dist/.');
