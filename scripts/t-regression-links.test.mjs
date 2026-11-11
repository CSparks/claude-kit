#!/usr/bin/env node
// Tests for `t new regression` (KIT-T985): both --regressed-from and --causing-commit are required
// at creation; a bug or feature needs neither. Drives the real CLI. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { field, splitFrontmatter } from './frontmatter.mjs';

const SCRIPT = fileURLToPath(new URL('./t.mjs', import.meta.url));
let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); }
};

const SANDBOX = mkdtempSync(join(tmpdir(), 'kit-tregress-'));
const REGISTRY = join(SANDBOX, 'projects.json');
writeFileSync(REGISTRY, JSON.stringify({ projects: {} }));
const ENV = { ...process.env, CLAUDE_PLUGIN_ROOT: SANDBOX, CLAUDE_KIT_REGISTRY: REGISTRY };

const CONFIG = `classifications:
  bug: { routes_to: tickets }
  regression: { routes_to: tickets }
  feature: { routes_to: tickets }
statuses:
  flow: [todo, doing, review, done]
uat:
  default: none
history:
  archive_done_to: tickets/archive
ids:
  key: "KIT"
  prefix: "KIT-T"
  pad: 3
`;

const store = () => {
  const root = mkdtempSync(join(SANDBOX, 'p-'));
  mkdirSync(join(root, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), CONFIG);
  return root;
};
const t = (root, ...args) => spawnSync(process.execPath, [SCRIPT, 'new', ...args, '--root', root], { encoding: 'utf8', env: ENV });
const tickets = (root) => readdirSync(join(root, '.ai', 'tickets')).filter((f) => /^KIT-T\d+-.*\.md$/.test(f));
const fm = (root, file) => splitFrontmatter(readFileSync(join(root, '.ai', 'tickets', file), 'utf8')).fm;

try {
  let root = store();
  let r = t(root, 'regression', 'Render breaks after the merge');
  ok('a regression with neither flag is refused', r.status !== 0);
  ok('the refusal names --regressed-from and --causing-commit', /--regressed-from/.test(r.stderr) && /--causing-commit/.test(r.stderr));
  ok('a refused regression mints no ticket', tickets(root).length === 0);

  r = t(root, 'regression', 'Render breaks after the merge', '--regressed-from', 'KIT-T001');
  ok('a regression without --causing-commit is refused, naming that flag only', r.status !== 0 && /--causing-commit/.test(r.stderr) && !/--regressed-from/.test(r.stderr));

  r = t(root, 'regression', 'Render breaks after the merge', '--causing-commit', 'a1b2c3d');
  ok('a regression without --regressed-from is refused, naming that flag only', r.status !== 0 && /--regressed-from/.test(r.stderr) && !/--causing-commit/.test(r.stderr));

  r = t(root, 'regression', 'Render breaks after the merge', '--regressed-from', 'not an id', '--causing-commit', 'a1b2c3d');
  ok('a malformed --regressed-from is refused before an id is minted', r.status !== 0 && tickets(root).length === 0);

  r = t(root, 'regression', 'Render breaks after the merge', '--regressed-from', 'KIT-T001', '--causing-commit', 'a1b2c3d');
  ok('a regression with both flags is created', r.status === 0 && tickets(root).length === 1);
  const made = tickets(root)[0];
  ok('the ticket carries regressed_from and causing_commit', field(fm(root, made), 'regressed_from') === 'KIT-T001' && field(fm(root, made), 'causing_commit') === 'a1b2c3d');

  root = store();
  r = t(root, 'bug', 'Plain bug needs no links');
  ok('a bug needs neither flag', r.status === 0 && tickets(root).length === 1);
  r = t(root, 'feature', 'Plain feature needs no links');
  ok('a feature needs neither flag', r.status === 0 && tickets(root).length === 2);
} finally {
  rmSync(SANDBOX, { recursive: true, force: true });
}

console.log(`\nt-regression-links: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
