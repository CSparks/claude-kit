// code-graph hook (KIT-T012): the Stop hook refreshes a machine-local graph cache for an
// adopted repo and writes nothing for an unadopted one. The cache dir is isolated via
// CLAUDE_CODE_GRAPH_CACHE; assertions count cache entries rather than guess a filename
// (the key comes from git's normalized path).
// Run: node hooks/code-graph.test.mjs

import { existsSync, readdirSync } from 'node:fs';

import { adopted, cleanup, hook, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('code-graph');

const jsonCount = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0);

try {
  const adoptedCache = tmpDir('kit-cg-a-');
  const bareCache = tmpDir('kit-cg-b-');
  const run = (cwd, cache) => hook('code-graph.mjs', {}, cwd, { CLAUDE_CODE_GRAPH_CACHE: cache });

  ok('code-graph: refreshes a machine-local cache for an adopted repo',
    run(adopted(true), adoptedCache).code === 0 && jsonCount(adoptedCache) === 1);
  ok('code-graph: non-adopted repo writes no cache',
    run(repo(), bareCache).code === 0 && jsonCount(bareCache) === 0);
} finally {
  cleanup();
}

done();
