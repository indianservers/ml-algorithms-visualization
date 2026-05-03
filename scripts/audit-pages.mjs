import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/pages/algorithms', import.meta.url));
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!full.endsWith('.tsx')) continue;
    if (full.includes(`${join('algorithms', 'shared')}`)) continue;
    const text = readFileSync(full, 'utf8');
    if (text.includes('AlgorithmModulePage')) offenders.push(full);
  }
}

walk(root);

if (offenders.length) {
  console.error('Page audit failed. AlgorithmModulePage appears in algorithm page files:');
  offenders.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

console.log('Page audit passed: AlgorithmModulePage is not used by algorithm pages.');
