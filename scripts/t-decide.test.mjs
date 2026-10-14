#!/usr/bin/env node
// t-decide.test.mjs — `t decide --file <draft>` records a decision through the CLI (KIT-T481):
// a valid draft lands as <id>-<slug>.md with normalised frontmatter and its body kept verbatim;
// a draft id is claimed exactly or refused; a bad draft is refused before any id is minted.
// Run: node scripts/t-decide.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordDecision } from './t-decide.mjs';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };
const dirs = [];

// A throwaway store; a unique key keeps its id reservations apart from every other run.
function store() {
  const root = mkdtempSync(join(tmpdir(), 'kit-decide-'));
  dirs.push(root);
  mkdirSync(join(root, '.ai', 'decisions'), { recursive: true });
  const key = `Z${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  writeFileSync(join(root, '.ai', 'config.yml'), `ids:\n  key: "${key}"\n  pad: 3\n`);
  writeFileSync(join(root, '.ai', 'decisions', `${key}-D001-first.md`), `---\nid: ${key}-D001\ntitle: first\n---\n`);
  return { root, key, dir: join(root, '.ai', 'decisions') };
}

const BODY = '**Decision:** Ship it.\n\n**Why:** Chris: "That should be policy."\n- a list line\n';
const draft = (fm) => `---\n${fm}\n---\n\n${BODY}`;

try {
  ok('a valid draft lands as the next id with normalised frontmatter and the body verbatim', () => {
    const s = store();
    const r = recordDecision(s.root, draft('title: Kit agent stands by\nsummary: one warm agent\nsource: chat\ndate: 2026-10-14'));
    assert.equal(r.id, `${s.key}-D002`);
    assert.match(r.path, /-D002-kit-agent-stands-by\.md$/);
    const text = readFileSync(r.path, 'utf8');
    assert.match(text, new RegExp(`^---\\nid: ${s.key}-D002\\ntitle: Kit agent stands by\\nsummary: one warm agent\\ndate: 2026-10-14\\nsupersedes: \\nsource: chat\\n---\\n\\n`));
    assert.ok(text.endsWith(BODY), 'body kept verbatim');
  });

  ok('a draft id that is free and above the highest is claimed exactly, gaps allowed', () => {
    const s = store();
    assert.equal(recordDecision(s.root, draft(`id: ${s.key}-D002\ntitle: a`)).id, `${s.key}-D002`);
    assert.equal(recordDecision(s.root, draft(`id: ${s.key}-D005\ntitle: b`)).id, `${s.key}-D005`);
  });

  ok('negative: a taken or stale draft id, a missing Decision/Why, a bad date or title are refused and mint nothing', () => {
    const s = store();
    const before = readdirSync(s.dir).length;
    assert.throws(() => recordDecision(s.root, draft(`id: ${s.key}-D001\ntitle: x`)), /already exists/);
    assert.throws(() => recordDecision(s.root, `---\ntitle: x\n---\n\n**Decision:** only\n`), /\*\*Why:\*\*/);
    assert.throws(() => recordDecision(s.root, `---\ntitle: x\n---\n\n**Why:** only\n`), /\*\*Decision:\*\*/);
    assert.throws(() => recordDecision(s.root, draft('title: x\ndate: 14/10/2026')), /YYYY-MM-DD/);
    assert.throws(() => recordDecision(s.root, draft('summary: no title')), /title: is required/);
    assert.throws(() => recordDecision(s.root, BODY), /frontmatter/);
    assert.equal(readdirSync(s.dir).length, before);
    assert.equal(recordDecision(s.root, draft('title: next')).id, `${s.key}-D002`, 'no id was burned by the refusals');
  });

  ok('the CLI records a draft file and prints the id', () => {
    const s = store();
    const file = join(s.root, 'draft.md');
    writeFileSync(file, draft('title: through the cli'));
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 't.mjs'), 'decide', '--file', file, '--root', s.root], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_REGISTRY: join(s.root, 'none.json') } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`^decide: ${s.key}-D002 -> `));
    assert.ok(readdirSync(s.dir).some((f) => f.startsWith(`${s.key}-D002-through-the-cli`)));
    const bad = spawnSync(process.execPath, [join(import.meta.dirname, 't.mjs'), 'decide', '--root', s.root], { encoding: 'utf8' });
    assert.equal(bad.status, 2, 'no --file is a usage error');
  });
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}
console.log(`t-decide: ${passed} passed, 0 failed`);
