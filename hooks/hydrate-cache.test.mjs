// hydrate-cache contract: it NEVER wedges a session — every path exits 0, including a
// corrupt registry. The store DB is isolated via CLAUDE_PLUGIN_ROOT.
// Run: node hooks/hydrate-cache.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TMP_REG, adopted, cleanup, hook, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('hydrate-cache');

try {
  const dbEnv = { CLAUDE_PLUGIN_ROOT: tmpDir('kit-db-') };
  ok('hydrate-cache: unadopted repo no-ops', hook('hydrate-cache.mjs', {}, repo(), dbEnv).code === 0);

  const hyd = adopted(false);
  mkdirSync(join(hyd, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(hyd, '.ai', 'tickets', 'H-T001-x.md'), '---\nid: H-T001\ntitle: x\nstatus: todo\n---\n');
  writeFileSync(TMP_REG, JSON.stringify({ projects: { hydeproj: hyd } }));
  const r1 = hook('hydrate-cache.mjs', {}, hyd, dbEnv);
  const r2 = hook('hydrate-cache.mjs', {}, hyd, dbEnv);
  ok('hydrate-cache: refresh path exits clean (fail-open contract)', r1.code === 0 && r2.code === 0);
  ok('hydrate-cache: second run is fresh (no refresh receipt)', !r2.out.includes('refreshed'));

  writeFileSync(TMP_REG, 'garbage{{{not json');
  ok('hydrate-cache: broken registry fails open', hook('hydrate-cache.mjs', {}, hyd, dbEnv).code === 0);
  writeFileSync(TMP_REG, '{}');
} finally {
  cleanup();
}

done();
