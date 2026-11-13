// No write lands in the files a running build compiles (KIT-T1114): the write guard (holder-beat.mjs) refuses another
// writer's edit to a build input inside a live build hold's recorded scope, and passes the build's own writer, every other
// file, a hold in its test phase and a hold with no recorded scope.
// Run: node hooks/build-write-hold.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, makeRepo } from './dispatch-guard-harness.mjs';

const slots = mkdtempSync(join(tmpdir(), 'bw-slots-'));
process.env.CLAUDE_KIT_BUILD_SLOT_DIR = slots;
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'bw-holders-'));
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'bw-state-'));

const tree = makeRepo();
const crate = join(tree, 'crates', 'a');
const other = join(tree, 'crates', 'b');
for (const dir of [join(crate, 'src'), join(other, 'src'), join(tree, 'docs')]) mkdirSync(dir, { recursive: true });
const OWNER = 'S1|agentBuilder';

const hold = (extra) => writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: process.pid, host: hostname(), label: `${tree}: cargo test -p a`, cwd: tree, jobs: 4, ts: new Date().toISOString(), ...extra }));
const edit = (session, agent, ...segments) => {
  const file = join(tree, ...segments);
  writeFileSync(file, 'x\n');
  return spawnSync(process.execPath, [fileURLToPath(new URL('./holder-beat.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify({ session_id: session, ...(agent ? { agent_id: agent } : {}), tool_input: { file_path: file } }) });
};

hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
const refused = edit('S1', 'agentOther', 'crates', 'a', 'src', 'lib.rs');
expect('another agent\'s edit of a source file in the building crate is refused', refused.status, 2);
expect('the refusal says to retry after the build and names the build and its starter', /Retry after the build/.test(refused.stderr) && /cargo test -p a/.test(refused.stderr) && /S1\|agentBuilder/.test(refused.stderr) ? 1 : 0, 1);
expect('another session\'s edit is refused too', edit('S2', '', 'crates', 'a', 'src', 'lib.rs').status, 2);
expect('negative control: the build\'s own writer edits freely', edit('S1', 'agentBuilder', 'crates', 'a', 'src', 'lib.rs').status, 0);
expect('negative control: an edit in a crate the build does not compile passes', edit('S1', 'agentOther', 'crates', 'b', 'src', 'lib.rs').status, 0);
expect('negative control: a doc in the repo passes', edit('S1', 'agentOther', 'docs', 'x.md').status, 0);
expect('a file in the building crate that no compile reads (not a build input) passes', edit('S1', 'agentOther', 'crates', 'a', 'README.md').status, 0);

hold({ scope: [crate], writer: OWNER, phase: 'running' });
expect('a hold in its test phase no longer compiles: the edit passes', edit('S1', 'agentOther', 'crates', 'a', 'src', 'two.rs').status, 0);

hold({ writer: OWNER, phase: 'compiling' });
expect('a hold with no recorded scope never refuses', edit('S1', 'agentOther', 'crates', 'a', 'src', 'three.rs').status, 0);

hold({ scope: [crate], phase: 'compiling' });
expect('a build with no recorded writer (a terminal) is foreign to every agent', edit('S1', 'agentOther', 'crates', 'a', 'src', 'four.rs').status, 2);

writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: 2 ** 22 + 12345, host: hostname(), cwd: tree, label: 'dead', scope: [crate], ts: new Date().toISOString() }));
expect('a dead build\'s hold refuses nothing', edit('S1', 'agentOther', 'crates', 'a', 'src', 'four.rs').status, 0);

finish();
