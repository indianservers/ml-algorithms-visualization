import { readFileSync } from 'node:fs';

const navText = readFileSync('src/data/navigation.ts', 'utf8');
const routerText = readFileSync('src/routes/router.tsx', 'utf8');

const navRoutes = [...navText.matchAll(/route:\s*'([^']+)'/g)].map(match => match[1]);
const routerRoutes = [...routerText.matchAll(/path:\s*'([^']+)'/g)]
  .map(match => match[1])
  .filter(route => route.startsWith('ml/'))
  .map(route => `/${route}`);

const missingFromNav = routerRoutes.filter(route => !navRoutes.includes(route));
const missingFromRouter = navRoutes.filter(route => !routerRoutes.includes(route));

if (missingFromNav.length || missingFromRouter.length) {
  console.error('Navigation audit failed.');
  if (missingFromNav.length) {
    console.error('Routes missing from main menu:');
    missingFromNav.forEach(route => console.error(`- ${route}`));
  }
  if (missingFromRouter.length) {
    console.error('Menu entries missing from router:');
    missingFromRouter.forEach(route => console.error(`- ${route}`));
  }
  process.exit(1);
}

console.log(`Navigation audit passed: ${navRoutes.length} menu routes match ${routerRoutes.length} routed ML pages.`);
