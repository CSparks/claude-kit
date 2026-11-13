// The session writes ledger (KIT-T407) keeps every path when several writers of one session record at once (KIT-T1133,
// KIT-T1049): commit-foreign refused files the committing agent had written because a concurrent writer's
// read-modify-write dropped them.
// Run: node hooks/session-writes-race.test.mjs

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { cleanup, git, identify, ENV, HOOKS, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('session-writes-race');
const WRITERS = 12;
const PATHS_EACH = 5;

try {
  const stateDir = tmpDir('swrites-state-');
  process.env.CLAUDE_KIT_TURN_STATE = stateDir;
  const root = identify(repo());
  writeFileSync(join(root, 'seed.txt'), 'x\n');
  git(['add', '--', 'seed.txt'], root);
  git(['commit', '-q', '-m', 'seed'], root);
  const { recordSessionPath, sessionWrites, sessionWriteHeads, sessionsWriting, foreignPaths } = await import('./turn-writes.mjs');

  const script = `import { recordSessionPath } from ${JSON.stringify(pathToFileURL(join(HOOKS, 'turn-writes.mjs')).href)};
const [root, who, count] = process.argv.slice(1);
for (let i = 0; i < Number(count); i++) recordSessionPath(root, 'crate/' + who + '-' + i + '.rs', 'S1');`;
  const run = (who) => new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, root, String(who), String(PATHS_EACH)], { env: { ...ENV, CLAUDE_KIT_TURN_STATE: stateDir }, stdio: 'ignore' });
    child.on('close', resolve);
  });
  await Promise.all(Array.from({ length: WRITERS }, (_, who) => run(who)));

  const wanted = Array.from({ length: WRITERS * PATHS_EACH }, (_, n) => `crate/${Math.floor(n / PATHS_EACH)}-${n % PATHS_EACH}.rs`);
  const mine = sessionWrites(root, 'S1');
  ok(`all ${wanted.length} paths of ${WRITERS} concurrent writers are in the ledger`, wanted.every((p) => mine.has(p)));
  ok('every path carries the HEAD it was written at', wanted.every((p) => sessionWriteHeads(root, 'S1')[p] === git(['rev-parse', 'HEAD'], root).trim()));
  ok('foreignPaths names none of them', foreignPaths(root, wanted, 'S1').length === 0);
  ok('sessionsWriting counts them for the session', sessionsWriting(root, wanted)[0]?.count === wanted.length);

  recordSessionPath(root, 'crate/again.rs', 'S1');
  recordSessionPath(root, 'crate/again.rs', 'S1');
  ok('a path recorded twice is one entry', [...sessionWrites(root, 'S1')].filter((p) => p === 'crate/again.rs').length === 1);
  ok('negative control: a path no writer recorded is foreign', foreignPaths(root, ['crate/other.rs'], 'S1').join() === 'crate/other.rs');
  ok('negative control: another session has no ledger', sessionWrites(root, 'S2').size === 0);
} finally {
  cleanup();
}

done();
