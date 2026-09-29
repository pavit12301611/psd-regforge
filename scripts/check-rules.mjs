/**
 * Static audit of firestore.rules.
 *
 * The Firestore emulator needs Java and a Google-hosted jar, which some build
 * environments cannot download. This script checks the security invariants that
 * matter for RegForge directly in the rules source, so a regression is caught by
 * `npm run check:rules` even without an emulator.
 *
 * Run: npm run check:rules
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const raw = readFileSync(path.join(root, 'firestore.rules'), 'utf8');
// Collapse whitespace so formatting changes do not break the assertions, and
// keep a comment-free copy for the "no privileged shortcut" scan.
const src = raw.replace(/\s+/g, ' ');
const code = raw
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

const errors = [];
const checks = [];
function check(label, condition) {
  checks.push({ label, ok: Boolean(condition) });
  if (!condition) errors.push(label);
}

/* ------------------------------------------------------------------- shape */
check("rules_version = '2'", /rules_version = '2';/.test(src));
check('workspace path is users/{uid}/questionnaires/{token}', /match \/users\/\{uid\} \{/.test(src) && /match \/questionnaires\/\{token\} \{/.test(src));
check('share index is shareTokens/{token}', /match \/shareTokens\/\{token\} \{/.test(src));

/* ---------------------------------------------------- google-owner boundary */
check(
  'isWorkspaceUser requires a Google session AND the same uid',
  /function isWorkspaceUser\(uid\) \{ return isGoogleUser\(\) && request\.auth\.uid == uid; \}/.test(src),
);
check(
  'isGoogleUser pins firebase sign_in_provider to google.com',
  /sign_in_provider == 'google\.com'/.test(src),
);
check(
  'workspace profile get/create/update is UID-scoped',
  /allow get: if isWorkspaceUser\(uid\); allow create: if isWorkspaceUser\(uid\)/.test(src) &&
    /allow update: if isWorkspaceUser\(uid\)/.test(src),
);

/* ------------------------------------------------- direct-link (share) path */
check(
  'share access proves the exact token index -> nested document match',
  /function hasShareAccess\(uid, token\) \{[\s\S]*?exists\(shareIndex\(token\)\)[\s\S]*?\.data\.token == token[\s\S]*?\.data\.ownerUid == uid; \}/.test(src),
);
check(
  'shared viewers can read only the questionnaire that the index points at',
  /allow get: if isWorkspaceUser\(uid\) \|\| hasShareAccess\(uid, token\);/.test(src),
);
check(
  'questionnaire list stays owner-only',
  /allow list: if isWorkspaceUser\(uid\);/.test(src),
);
check(
  'client updates may touch only answers, updatedAt and submittedAt',
  /affectedKeys\(\) \.hasOnly\(\['answers', 'updatedAt', 'submittedAt'\]\)/.test(src),
);
check(
  'client questionnaire updates require share access',
  /function validClientQuestionnaireUpdate\(uid, token\) \{ return hasShareAccess\(uid, token\)/.test(src),
);

/* ------------------------------------------------------- no listing for shares */
check(
  'shareTokens cannot be listed (exact get only)',
  /match \/shareTokens\/\{token\} \{ (?:\/\/[^\\]*)*?allow get: if isShareViewer\(\);[\s\S]*?allow list: if false;/.test(src),
);
check('share index is metadata-only', /shareTokens\/\{token\} [\s\S]*?token, ownerUid, createdAt, updatedAt/.test(src) || /keys\(\)\.hasOnly\(\['token', 'ownerUid', 'createdAt', 'updatedAt'\]\)/.test(src));
check('no rule grants list to an anonymous client', !/allow list: if isShareViewer\(\)/.test(src) && !/allow list: if isAnonymousClient\(\)/.test(src));
check('anonymous provider checks never gate the workspace path', !/allow (?:get|list|create|update|delete): if isAnonymousClient\(\)/.test(src));

/* --------------------------------------------------- no privileged shortcuts */
const banned = ['admin', 'allowlist', 'allowList', 'claim', 'pin', 'password', 'ownerEmail ==', 'request.auth.token.email'];
for (const term of banned) {
  check(`no "${term}" shortcut in the rules`, !code.toLowerCase().includes(term.toLowerCase()));
}
check(
  'no other collection is readable by default',
  /match \/\{document=\*\*\} \{ allow read, write: if false; \}/.test(src),
);

/* ------------------------------------------------------------------ report */
for (const { label, ok } of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
}
console.log(`\n${checks.length - errors.length}/${checks.length} rule invariants hold.`);
if (errors.length) {
  console.error(`\nFAILED:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('OK — firestore.rules keeps the documented boundaries.');
