#!/usr/bin/env node
// active-inbox.test.mjs — untriaged captures newer than SESSION.md are the live work the anchor does not
// describe; older ones, triaged ones and the README are not.
// Run: node hooks/active-inbox.test.mjs

import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeInboxNotes } from './lib/active-inbox.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const root = mkdtempSync(join(tmpdir(), 'kit-activeinbox-'));
const ai = join(root, '.ai');
mkdirSync(join(ai, 'inbox', 'triaged'), { recursive: true });
const at = (path, secondsAgo) => { const t = (Date.now() - secondsAgo * 1000) / 1000; utimesSync(path, t, t); };
const write = (path, text, secondsAgo) => { writeFileSync(path, text); at(path, secondsAgo); };

try {
  write(join(ai, 'SESSION.md'), '# SESSION\n', 3600);
  write(join(ai, 'inbox', 'old.md'), 'older than the anchor\n', 7200);
  write(join(ai, 'inbox', 'a.md'), '(note) the alternate integrated shell is the live model\n', 600);
  write(join(ai, 'inbox', 'b.md'), '(bug) second note\n', 60);
  write(join(ai, 'inbox', 'README.md'), 'readme\n', 60);
  write(join(ai, 'inbox', 'triaged', 'c.md'), 'triaged\n', 60);

  const r = activeInboxNotes(root);
  check('counts only untriaged captures newer than the anchor', r.total === 2, JSON.stringify(r));
  check('newest first, with age and first line', /second note/.test(r.lines[0]) && /live model/.test(r.lines[1]) && /^0h ago/.test(r.lines[0]));
  check('a limit caps the lines but not the count', activeInboxNotes(root, { limit: 1 }).lines.length === 1 && activeInboxNotes(root, { limit: 1 }).total === 2);
  check('long first lines are clipped', activeInboxNotes(root, { lineMax: 10 }).lines.every((l) => l.length < 30));
  rmSync(join(ai, 'SESSION.md'));
  check('no anchor, no judgement: fails open', activeInboxNotes(root).total === 0);
  check('no .ai at all: fails open', activeInboxNotes(join(root, 'nowhere')).total === 0);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
