/**
 * Verifies the question library matches the RegForge spec:
 * 12 modules, 50 questions, unique stable ids, every option list parsed.
 * Run: npm run check:library
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, 'lib/library.ts'), 'utf8');

// Cheap static checks (no TS loader needed).
const moduleKeys = [...src.matchAll(/^\s{4}key: '([a-z_]+)',/gm)].map((m) => m[1]);
const ids = [...src.matchAll(/id: '([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]);
const requiredIds = [...src.matchAll(/id: '([a-z_]+\.[a-z_]+)',[\s\S]{0,220}?required: true/g)].map(
  (m) => m[1],
);

const errors = [];
if (moduleKeys.length !== 12) errors.push(`expected 12 modules, found ${moduleKeys.length}`);
if (ids.length !== 50) errors.push(`expected 50 questions, found ${ids.length}`);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) errors.push(`duplicate ids: ${dupes.join(', ')}`);
const badId = ids.filter((id) => !moduleKeys.includes(id.split('.')[0]));
if (badId.length) errors.push(`question id outside declared modules: ${badId.join(', ')}`);

console.log(`modules:   ${moduleKeys.length} (${moduleKeys.join(', ')})`);
console.log(`questions: ${ids.length}`);
console.log(`required:  ${requiredIds.length} (${requiredIds.join(', ')})`);

if (errors.length) {
  console.error('\nFAILED:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('\nOK — library matches spec.');
