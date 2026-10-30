#!/usr/bin/env node
// Tests for `t edit` (KIT-T725): replace one `## Section` of an item with the text of a file, leave
// every other section alone, stamp History, and refuse a missing section. Drives the real CLI.
// exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { replaceSection } from './md-body.mjs';

const SCRIPT = fileURLToPath(new URL('./t.mjs', import.meta.url));
let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); }
};

const SANDBOX = mkdtempSync(join(tmpdir(), 'kit-tedit-'));
const REGISTRY = join(SANDBOX, 'projects.json');
writeFileSync(REGISTRY, JSON.stringify({ projects: {} }));
const ENV = { ...process.env, CLAUDE_PLUGIN_ROOT: SANDBOX, CLAUDE_KIT_REGISTRY: REGISTRY };
const CONFIG = 'classifications:\n  bug: { routes_to: tickets }\nstatuses:\n  flow: [todo, doing, review, done]\nuat:\n  default: none\nhistory:\n  archive_done_to: tickets/archive\nids:\n  key: "KIT"\n  prefix: "KIT-T"\n  pad: 3\n';
const TICKET = `---
id: KIT-T001
title: seed
type: bug
status: todo
priority: high
links: []
---

## Description
old description
line two

## Acceptance Criteria
- [ ] keep me

## Plan
1. old plan

## History
- [2026-01-01 00:00] (created) bug — seed
`;

const root = mkdtempSync(join(SANDBOX, 'p-'));
mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), CONFIG);
const path = join(root, '.ai', 'tickets', 'KIT-T001-seed.md');
writeFileSync(path, TICKET);
const draft = join(SANDBOX, 'draft.md');
const t = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', env: ENV });
const text = () => readFileSync(path, 'utf8');

try {
  writeFileSync(draft, 'new description\nwith two lines\n');
  const r = t('edit', 'KIT-T001', '--section', 'Description', '--file', draft);
  const after = text();
  ok('edit: exit 0', r.status === 0);
  ok('edit: the section holds the new text', after.includes('## Description\nnew description\nwith two lines\n'));
  ok('edit: the old text is gone', !after.includes('old description') && !after.includes('line two'));
  ok('edit: Acceptance Criteria untouched', after.includes('## Acceptance Criteria\n- [ ] keep me\n'));
  ok('edit: Plan untouched', after.includes('## Plan\n1. old plan\n'));
  ok('edit: frontmatter untouched', after.startsWith(TICKET.slice(0, TICKET.indexOf('## Description'))));
  ok('edit: History records the edit', /\(edit\) Description replaced/.test(after) && after.includes('(created) bug — seed'));

  writeFileSync(draft, '1. step one\n2. step two\n');
  t('edit', 'KIT-T001', '--section', 'plan', '--file', draft);
  ok('edit: the section name matches case-insensitively', text().includes('## Plan\n1. step one\n2. step two\n') && text().includes('new description'));

  const before = text();
  r.status = t('edit', 'KIT-T001', '--section', 'Notes', '--file', draft);
  ok('edit: a missing section errors and names it', r.status.status !== 0 && /no .*Notes/i.test(r.status.stderr));
  ok('edit: a missing section leaves the file unchanged', text() === before);
  ok('edit: a section outside the editable set is refused', t('edit', 'KIT-T001', '--section', 'History', '--file', draft).status !== 0 && text() === before);
  ok('edit: an unknown id errors', t('edit', 'KIT-T999', '--section', 'Plan', '--file', draft).status !== 0);
  writeFileSync(draft, '  \n');
  ok('edit: an empty draft is refused', t('edit', 'KIT-T001', '--section', 'Plan', '--file', draft).status !== 0 && text() === before);
  ok('edit: --section and --file are both required', t('edit', 'KIT-T001', '--section', 'Plan').status !== 0);

  ok('replaceSection: a section at end of file', replaceSection('## A\nx\n', 'A', 'y') === '## A\ny\n');
  ok('replaceSection: absent returns null', replaceSection('## A\nx\n', 'B', 'y') === null);
} finally {
  rmSync(SANDBOX, { recursive: true, force: true });
}

console.log(`\nt-edit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
