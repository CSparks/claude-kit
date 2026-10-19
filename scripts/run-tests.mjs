// run-tests.mjs — `npm test` entry (KIT-T467, KIT-T570). Runs every tracked *.test.mjs, each as its
// own `node <file>`, with CLAUDE_KIT_REGISTRY pointing at an empty throwaway registry so no suite
// hydrates the maintainer's live project stores. Records each file's wall time in
// .cache/test-times.json and prints the slowest ten. A suite that needs projects registered sets its
// own CLAUDE_KIT_REGISTRY.
//
//   node scripts/run-tests.mjs [--root <dir>] [--only <substring>]

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverTests } from './test-runner/discover.mjs';
import { runFile } from './test-runner/run-file.mjs';
import { readTimes, slowest, writeTimes } from './test-runner/times.mjs';

const SLOWEST_SHOWN = 10;
const flag = (name) => { const i = process.argv.indexOf(name); return i === -1 ? undefined : process.argv[i + 1]; };
const root = resolve(flag('--root') || join(dirname(fileURLToPath(import.meta.url)), '..'));
const timesFile = process.env.KIT_TEST_TIMES || join(root, '.cache', 'test-times.json');
const only = flag('--only');

const scratch = mkdtempSync(join(tmpdir(), 'kit-test-reg-'));
const registry = join(scratch, 'registry.json');
writeFileSync(registry, '{}\n');
const env = { ...process.env, CLAUDE_KIT_REGISTRY: registry, BROKER_NO_AUTOSTART: '1' };

const files = discoverTests(root).filter((f) => !only || f.includes(only));
const results = [];
const started = Date.now();
for (const file of files) {
  const r = await runFile(root, file, env);
  results.push(r);
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${(r.ms / 1000).toFixed(1).padStart(6)}s  ${file}`);
  if (!r.ok) console.log(r.output);
}
rmSync(scratch, { recursive: true, force: true });
writeTimes(timesFile, results);

console.log(`\nslowest ${SLOWEST_SHOWN} (of ${results.length} files, ${((Date.now() - started) / 1000).toFixed(0)}s wall):`);
for (const r of slowest(results, SLOWEST_SHOWN)) console.log(`  ${(r.ms / 1000).toFixed(1).padStart(6)}s  ${r.file}`);
const failed = results.filter((r) => !r.ok);
if (failed.length) console.log(`\n${failed.length} FAILED: ${failed.map((r) => r.file).join(', ')}`);
process.exit(failed.length ? 1 : 0);
