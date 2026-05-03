import { readFileSync } from 'node:fs';

const baseUrl = process.env.SMOKE_BASE_URL ?? process.argv[2];
if (!baseUrl) {
  console.error('Usage: node scripts/smoke-routes.mjs http://127.0.0.1:29968');
  process.exit(1);
}

const router = readFileSync(new URL('../src/routes/router.tsx', import.meta.url), 'utf8');
const routes = [...router.matchAll(/path:\s*'([^']+)'/g)]
  .map(match => match[1])
  .filter(route => route.startsWith('ml/'))
  .map(route => `/${route}`);

const failures = [];
for (const route of routes) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${route}`);
  if (!response.ok) failures.push({ route, status: response.status });
}

if (failures.length) {
  console.error(`Smoke test failed for ${failures.length}/${routes.length} routes`);
  failures.forEach(failure => console.error(`${failure.status} ${failure.route}`));
  process.exit(1);
}

console.log(`Smoke test passed for ${routes.length} algorithm routes.`);
