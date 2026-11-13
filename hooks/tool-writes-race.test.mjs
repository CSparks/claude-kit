// The accepted-writes ledger (KIT-T888) keeps every entry when several writers of a checkout record at once (KIT-T1138):
// a lost entry makes commit-foreign and hand-write-detect flag the agent's own file as foreign.
// Run: node hooks/tool-writes-race.test.mjs

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { cleanup, ENV, HOOKS, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('tool-writes-race');
const WRITERS = 12;
const ENTRIES_EACH = 5;
const HASH = (who, i) => `h${who}-${i}`;
const SINCE_MS = 0;

try {
  const stateDir = tmpDir('twrites-state-');
  process.env.CLAUDE_KIT_TURN_STATE = stateDir;
  const root = tmpDir('twrites-root-');
  const { recordToolWrite, toolWriteProves } = await import('./lib/tool-writes.mjs');
  const { writeTurnState } = await import('./lib/turn-state.mjs');

  writeTurnState(root, { entries: [{ p: 'old/legacy.rs', h: 'legacy-hash', ts: Date.now(), w: 'OLD|', c: true }] }, 'toolwrites');

  const script = `import { recordToolWrite } from ${JSON.stringify(pathToFileURL(join(HOOKS, 'lib', 'tool-writes.mjs')).href)};
const [root, who, count] = process.argv.slice(1);
for (let i = 0; i < Number(count); i++) recordToolWrite(root, 'crate/' + who + '-' + i + '.rs', 'h' + who + '-' + i, Date.now(), 'S' + who + '|');`;
  const run = (who) => new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, root, String(who), String(ENTRIES_EACH)], { env: { ...ENV, CLAUDE_KIT_TURN_STATE: stateDir }, stdio: 'ignore' });
    child.on('close', resolve);
  });
  await Promise.all(Array.from({ length: WRITERS }, (_, who) => run(who)));

  const proven = (who, i) => toolWriteProves(root, `crate/${who}-${i}.rs`, SINCE_MS, HASH(who, i), 'OTHER|');
  const missing = [];
  for (let who = 0; who < WRITERS; who++) for (let i = 0; i < ENTRIES_EACH; i++) if (!proven(who, i)) missing.push(`${who}-${i}`);
  ok(`all ${WRITERS * ENTRIES_EACH} entries of ${WRITERS} concurrent writers are in the ledger (missing: ${missing.join(',') || 'none'})`, missing.length === 0);
  ok('an entry a state file of an older hook version holds is still read', toolWriteProves(root, 'old/legacy.rs', SINCE_MS, 'legacy-hash', 'OTHER|'));

  recordToolWrite(root, 'crate/own.rs', 'own-hash', Date.now(), 'S1|');
  ok('negative control: an entry never exempts its own writer', !toolWriteProves(root, 'crate/own.rs', SINCE_MS, 'own-hash', 'S1|'));
  ok('negative control: a hash no writer recorded proves nothing', !toolWriteProves(root, 'crate/0-0.rs', SINCE_MS, 'unrecorded', 'OTHER|'));
  ok('negative control: a path no writer recorded proves nothing', !toolWriteProves(root, 'crate/none.rs', SINCE_MS, HASH(0, 0), 'OTHER|'));
} finally {
  cleanup();
}

done();
