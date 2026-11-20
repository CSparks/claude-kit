#!/usr/bin/env node
// t-notes-heading.test.mjs — `t notes` finds an existing ## Notes and ## History heading that carries
// trailing whitespace (KIT-T1445), so prose lands under it instead of opening a duplicate section.
// Run: node scripts/t-notes-heading.test.mjs

import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendNotes } from './t-notes.mjs';
import { scaffoldNew } from './t.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_AI = join(HERE, '..', '.ai');
const root = mkdtempSync(join(tmpdir(), 'kit-notes-heading-'));

try {
  for (const s of ['tickets', 'epics', 'requests', 'notes', 'questions']) {
    mkdirSync(join(root, '.ai', s), { recursive: true });
    if (s !== 'tickets') copyFileSync(join(KIT_AI, s, '_TEMPLATE.md'), join(root, '.ai', s, '_TEMPLATE.md'));
  }
  writeFileSync(join(root, '.ai', 'config.yml'), 'classifications:\n  bug: { routes_to: tickets, priority: high }\nstatuses:\n  flow: [todo, doing, review, done]\nuat:\n  default: none\nids:\n  key: "HDG"\n  pad: 3\n');

  const t = scaffoldNew(root, 'bug', 'heading whitespace', { description: 'why' });
  const padded = readFileSync(t.path, 'utf8')
    .replace(/^## Notes$/m, '## Notes   ')
    .replace(/^## History$/m, '## Notes   \nearlier prose\n\n## History \t');
  assert.match(padded, /^## Notes {3}$/m, 'fixture carries a padded ## Notes heading');
  writeFileSync(t.path, padded);

  appendNotes(root, t.id, 'after padded heading');
  const after = readFileSync(t.path, 'utf8');
  assert.equal((after.match(/^## Notes/gm) ?? []).length, 1, 'no duplicate ## Notes section');
  assert.match(after, /^## Notes {3}\nearlier prose\nafter padded heading\n\n## History/m);
  console.log('  ok    t notes matches a ## Notes / ## History heading with trailing whitespace');
  console.log('1 passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
