// framework-pin.test.mjs — the report-only framework pin step (KIT-D141, KIT-T891 slice 1) over throwaway git
// fixtures with a real submodule and an upstream that gains commits after the pin. Run: node hooks/framework-pin.test.mjs

import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { frameworkPinReport } from './lib/framework-pin.mjs';
import { cleanup, commit, consumer, git, SUB, snapshot, tmp, upstream, write } from './framework-pin-fixture.mjs';
import { reporter } from './test-harness.mjs';

const HOOK = fileURLToPath(new URL('./framework-pin.mjs', import.meta.url));
const MAX_UNREACHABLE_MS = 5000;
const MAX_SILENT_MS = 200;
const { ok, done } = reporter('framework-pin');

const cache = tmp('kit-pin-cache-');
const registryFile = join(cache, 'projects.json');
process.env.CLAUDE_KIT_CACHE_DIR = cache;
process.env.CLAUDE_KIT_REGISTRY = registryFile;
write(cache, 'projects.json', JSON.stringify({ projects: {} }));

const forgetFetches = () => readdirSync(cache).filter((f) => f.startsWith('fetched-')).forEach((f) => rmSync(join(cache, f)));
const report = (c, opts) => { forgetFetches(); return frameworkPinReport(c.root, opts); };
const alerts = (text) => text.split('\n').filter((l) => l.startsWith('!!'));
const advance = (up, ...files) => files.forEach(([msg, f]) => commit(up, msg, f));

try {
  let up = upstream();
  let c = consumer(up);
  let text = await report(c);
  ok('an up-to-date consumer prints its pin, origin/main and zero behind', /FRAMEWORK PIN \(KIT-D141\)/.test(text) && /behind 0 \/ ahead 0/.test(text));
  ok('an up-to-date consumer prints no !! line', alerts(text).length === 0);
  ok('the pin shown is the recorded gitlink', text.includes(git(c.root, 'rev-parse', `HEAD:${SUB}`).trim().slice(0, 7)));

  advance(up, ['core: one', { 'a.txt': 'one\n' }], ['core: two', { 'crates/core/src/lib.rs': '// core two\n' }], ['core: three', { 'b.txt': 'b\n' }]);
  text = await report(c);
  ok('behind 3 is counted and flagged !!', /behind 3 \/ ahead 0/.test(text) && alerts(text).some((l) => /BEHIND origin\/main by 3 commits/.test(l)));
  ok('the delta lists the three upstream subjects', ['core: one', 'core: two', 'core: three'].every((s) => text.includes(s)));
  ok('a changed framework crate names the consumer crate that depends on it as may break', /may break: game \(a build confirms\)/.test(text) && /changed crates: rg-core/.test(text));
  ok('the framework crate itself is not listed as may break', !/may break:[^\n]*rg-core/.test(text));

  advance(up, ...Array.from({ length: 9 }, (_, i) => [`bulk ${i}`, { [`bulk/${i}.txt`]: `${i}\n` }]));
  text = await report(c);
  ok('the delta caps at 8 subjects and counts the rest', (text.match(/^ {2}\S{7} /gm) || []).length === 8 && /\+4 more/.test(text));

  c = consumer(upstream());
  git(c.sub, 'remote', 'set-url', 'origin', join(tmp('kit-pin-gone-'), 'missing'));
  const started = Date.now();
  text = await report(c);
  ok('an unreachable remote reports FETCH FAILED with the ref age and finishes in 5 s or less', /!! FETCH FAILED \(.+\): judged against refs from/.test(text) && Date.now() - started <= MAX_UNREACHABLE_MS);
  ok('a failed fetch still reports the pin state', /behind 0 \/ ahead 0/.test(text));

  up = upstream();
  c = consumer(up);
  advance(up, ['upstream edits a', { 'a.txt': 'upstream\n' }]);
  write(c.sub, 'a.txt', 'mine\n');
  text = await report(c);
  ok('a tracked edit overlapping upstream names the path', alerts(text).some((l) => /CONFLICT FORECAST: your edits overlap upstream in a\.txt/.test(l)));
  ok('local framework work is flagged', alerts(text).some((l) => /LOCAL RAPID-GAME WORK: 1 tracked edit/.test(l)));

  up = upstream();
  c = consumer(up);
  advance(up, ['upstream edits a', { 'a.txt': 'upstream\n' }]);
  write(c.sub, 'crates/core/src/lib.rs', '// mine\n');
  text = await report(c);
  ok('control: a tracked edit upstream does not touch raises no overlap', !/CONFLICT FORECAST/.test(text));

  up = upstream();
  c = consumer(up);
  advance(up, ['upstream adds new.txt', { 'new.txt': 'theirs\n' }]);
  write(c.sub, 'new.txt', 'mine\n');
  text = await report(c);
  ok('an untracked path upstream adds is a collision', alerts(text).some((l) => /untracked new\.txt would collide/.test(l)));

  up = upstream();
  c = consumer(up);
  advance(up, ['upstream adds other/x.txt', { 'other/x.txt': 'theirs\n' }]);
  write(c.sub, 'scratch/notes.txt', 'mine\n');
  write(c.sub, 'other/y.txt', 'mine\n');
  text = await report(c);
  ok('control: untracked files upstream does not add raise no collision', !/CONFLICT FORECAST/.test(text) && alerts(text).some((l) => /2 untracked files/.test(l)));

  up = upstream();
  c = consumer(up);
  commit(c.sub, 'mine a', { 'a.txt': 'mine\n' });
  advance(up, ['upstream a', { 'a.txt': 'theirs\n' }]);
  text = await report(c);
  ok('a local commit that conflicts with origin/main is forecast with the path', alerts(text).some((l) => /your local commits conflict with origin\/main in a\.txt/.test(l)));

  up = upstream();
  c = consumer(up);
  commit(c.sub, 'mine b', { 'mine.txt': 'mine\n' });
  advance(up, ['upstream a', { 'a.txt': 'theirs\n' }]);
  text = await report(c);
  ok('a local commit that merges cleanly raises no conflict forecast', !/CONFLICT FORECAST/.test(text) && alerts(text).some((l) => /1 local commit not on origin\/main/.test(l)));

  up = upstream();
  c = consumer(up);
  commit(c.sub, 'unpushed pin target', { 'mine.txt': 'mine\n' });
  git(c.root, 'add', SUB);
  git(c.root, 'commit', '-q', '-m', 'pin to an unpushed commit');
  text = await report(c);
  ok('a gitlink that is not on origin/main is flagged', alerts(text).some((l) => /recorded pin [0-9a-f]{7} is not on origin\/main/.test(l)));

  up = upstream();
  c = consumer(up);
  write(c.sub, 'a.txt', 'edited\n');
  write(c.root, 'target/broker/subtree/rapid-game.lock', JSON.stringify({ lane: 'root', id: 'j1', pid: process.pid, host: hostname() }));
  advance(up, ['upstream a', { 'a.txt': 'theirs\n' }]);
  text = await report(c);
  ok('a broker lock on the tree reports from the gitlink and origin/main only', /broker holds the tree/.test(text) && /behind 1 \/ ahead 0/.test(text));
  ok('while the broker holds the tree the working tree is not read', !/LOCAL RAPID-GAME WORK|CONFLICT FORECAST/.test(text));

  up = upstream();
  c = consumer(up);
  const other = consumer(up, { name: 'other' });
  write(cache, 'projects.json', JSON.stringify({ projects: { game: c.root, 'other-game': other.root, nothing: tmp('kit-pin-none-') } }));
  text = await report(c);
  ok("one line lists the other consumers' pins and skips the session's own project and a non-consumer", /other consumers' pins: other-game [0-9a-f]{7}$/m.test(text) && !/game [0-9a-f]{7},/.test(text) && !/nothing/.test(text));
  write(cache, 'projects.json', JSON.stringify({ projects: {} }));

  up = upstream();
  c = consumer(up);
  commit(c.sub, 'mine a', { 'a.txt': 'mine\n' });
  write(c.sub, 'a.txt', 'edited again\n');
  write(c.sub, 'untracked.txt', 'u\n');
  advance(up, ['upstream a', { 'a.txt': 'theirs\n' }]);
  const before = snapshot(c);
  await report(c);
  await report(c, { fetch: false });
  ok('the report leaves HEAD, status, stashes and branches of both repos unchanged', snapshot(c) === before);
  ok('with the fetch skipped the header says so', /fetch skipped/.test(await report(c, { fetch: false })));
  await report(c);
  ok('a second report inside the throttle window does not fetch again', /fetch skipped/.test(await frameworkPinReport(c.root)));
  write(c.sub, 'control.txt', 'x\n');
  ok('control: the snapshot sees a change to the tree', snapshot(c) !== before);

  git(c.sub, 'update-ref', '-d', 'refs/remotes/origin/main');
  ok('a submodule with no origin/main ref is flagged, not crashed on', alerts(await report(c, { fetch: false })).some((l) => /no origin\/main ref/.test(l)));

  const plain = tmp('kit-pin-plain-');
  git(plain, 'init', '-q');
  const t0 = Date.now();
  const silent = await frameworkPinReport(plain);
  const silentMs = Date.now() - t0;
  ok(`a non-consumer repo prints nothing, in ${silentMs} ms (200 ms ceiling)`, silent === '' && silentMs <= MAX_SILENT_MS);
  const run = spawnSync(process.execPath, [HOOK], { cwd: plain, encoding: 'utf8', env: process.env });
  ok('the hook prints nothing and exits 0 in a non-consumer repo', run.status === 0 && run.stdout === '');
  const live = spawnSync(process.execPath, [HOOK], { cwd: c.root, encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_PIN_FETCH: '0' } });
  ok('the hook prints the block and exits 0 in a consumer repo', live.status === 0 && /FRAMEWORK PIN \(KIT-D141\)/.test(live.stdout));
} finally {
  cleanup();
}
done();
