#!/usr/bin/env node
// A sealed runtime copy's snapshot .ai is never indexed as a store (KIT-T502): the cross-scope
// hydrate takes the registry's live claude-kit store instead, so `q` never resolves a ticket
// to a runtime copy. A kit checkout outside the runtime keeps its own store (control).
// Run: node scripts/hydrate-sources.test.mjs

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const runtime = mkdtempSync(join(tmpdir(), 'hs-runtime-'));
const checkout = mkdtempSync(join(tmpdir(), 'hs-checkout-'));
const registry = join(runtime, 'registry.json');
process.env.CLAUDE_KIT_RUNTIME = runtime;
process.env.CLAUDE_KIT_REGISTRY = registry;
const sealed = join(runtime, 'abc1234');
mkdirSync(join(sealed, '.ai'), { recursive: true });

const { hydrationSources, defaultDbPath } = await import('./hydrate-db.mjs');
const { isSealedRuntime } = await import('./runtime-path.mjs');
let fail = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); } };

t('a sealed runtime copy contributes no own store', () => {
  assert.ok(isSealedRuntime(sealed));
  assert.ok(!hydrationSources(undefined, sealed).some((s) => resolve(s.aiDir) === resolve(join(sealed, '.ai'))));
});
t('control: a scratch export dir inside the runtime root is not a sealed copy (the publish gate runs there)', () => {
  assert.ok(!isSealedRuntime(join(runtime, '.verify-abc1234-1')));
});
t('control: a checkout outside the runtime contributes its own store', () => {
  assert.ok(!isSealedRuntime(checkout));
  assert.ok(hydrationSources(undefined, checkout).some((s) => resolve(s.aiDir) === resolve(join(checkout, '.ai'))));
});
t('CLAUDE_KIT_DB redirects the cache; unset falls back to the install', () => {
  process.env.CLAUDE_KIT_DB = join(checkout, 'x.db');
  assert.equal(defaultDbPath(), join(checkout, 'x.db'));
  delete process.env.CLAUDE_KIT_DB;
  assert.match(defaultDbPath(), /workflow\.db$/);
});

rmSync(runtime, { recursive: true, force: true });
rmSync(checkout, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
