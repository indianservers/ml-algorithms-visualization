import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const publicDir = join(root, 'public');
const navigation = readFileSync(join(root, 'src/data/navigation.ts'), 'utf8');
const domain = process.env.SITE_URL ?? 'https://www.aimersociety.com/MachineLearningAlgorithms';
const today = new Date().toISOString().slice(0, 10);

const algorithmRoutes = [...navigation.matchAll(/route:\s*'([^']+)'/g)]
  .map(match => match[1])
  .filter(route => route.startsWith('/ml/'));

const routes = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/documentation', priority: '0.9', changefreq: 'weekly' },
  { path: '/dataset-library', priority: '0.8', changefreq: 'weekly' },
  { path: '/sitemap', priority: '0.7', changefreq: 'weekly' },
  { path: '/implementation-matrix', priority: '0.7', changefreq: 'weekly' },
  ...algorithmRoutes.map(path => ({ path, priority: '0.8', changefreq: 'monthly' })),
];

const escapeXml = value =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const toUrl = path => `${domain.replace(/\/$/, '')}${path === '/' ? '/' : path}`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${escapeXml(toUrl(route.path))}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${toUrl('/sitemap.xml')}
`;

mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'sitemap.xml'), sitemap);
writeFileSync(join(publicDir, 'robots.txt'), robots);

console.log(`Generated sitemap.xml and robots.txt for ${routes.length} routes.`);
