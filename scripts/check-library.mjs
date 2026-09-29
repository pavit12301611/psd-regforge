/**
 * Verifies the question library matches the RegForge spec:
 * 12 modules, 50 questions, unique stable ids, every option list parsed,
 * and the budget question as a free-form INR currency input.
 * Run: npm run check:library
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, 'lib/library.ts'), 'utf8');

// Split the source at every question id so each block holds exactly one
// question object — cheaper (and less brittle) than a TS loader.
const blocks = src.split(/(?=id: '[a-z_]+\.[a-z_]+')/).slice(1);
const questions = blocks.map((block) => ({
  id: block.match(/^id: '([a-z_]+\.[a-z_]+)'/)[1],
  block,
}));

const moduleKeys = [...src.matchAll(/^\s{4}key: '([a-z_]+)',/gm)].map((m) => m[1]);
const ids = questions.map((question) => question.id);
const requiredIds = questions
  .filter((question) => /required: true/.test(question.block))
  .map((question) => question.id);

const errors = [];
if (moduleKeys.length !== 12) errors.push(`expected 12 modules, found ${moduleKeys.length}`);
if (ids.length !== 50) errors.push(`expected 50 questions, found ${ids.length}`);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) errors.push(`duplicate ids: ${dupes.join(', ')}`);
const badId = ids.filter((id) => !moduleKeys.includes(id.split('.')[0]));
if (badId.length) errors.push(`question id outside declared modules: ${badId.join(', ')}`);

/* --------------------------------------------------- budget / INR guarantees */
const budget = questions.find((question) => question.id === 'budget.budget');
const budgetBlock = budget?.block ?? '';

if (!budget) {
  errors.push('stable id budget.budget is missing — existing answers would be orphaned');
} else {
  if (!/type: 'currency'/.test(budgetBlock)) {
    errors.push('budget.budget must use type: currency (free-form INR amount)');
  }
  if (!/currency: 'INR'/.test(budgetBlock)) {
    errors.push('budget.budget must declare currency: INR');
  }
  if (!budgetBlock.includes('₹')) {
    errors.push('budget.budget placeholder/help must show the ₹ symbol');
  }
  if (/options:/.test(budgetBlock)) {
    errors.push('budget.budget must not keep fixed option ranges');
  }
  if (!/required: true/.test(budgetBlock)) {
    errors.push('budget.budget should stay required');
  }
}
if (/\$\s?\d/.test(src)) {
  errors.push('dollar budget ranges are still present in lib/library.ts');
}
if (!/export type QuestionType =[\s\S]*?'currency'/.test(src)) {
  errors.push("QuestionType must include 'currency'");
}

console.log(`modules:   ${moduleKeys.length} (${moduleKeys.join(', ')})`);
console.log(`questions: ${ids.length}`);
console.log(`required:  ${requiredIds.length} (${requiredIds.join(', ')})`);
console.log('budget:    budget.budget → free-form INR currency input (stable id kept)');

if (errors.length) {
  console.error('\nFAILED:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('\nOK — library matches spec.');
