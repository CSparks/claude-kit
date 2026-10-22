// deferred.mjs — foreign test failures are deferred, never forgotten (KIT-T271). Attribution
// (attribute.mjs) lets a job pass over a failure the patch did not cause; each such test lands
// here with the command, repo, job, reason and the hand-edited paths that were dirty. When the
// repo's HEAD moves or one of those paths turns clean, the broker re-runs only those tests on
// the live tree while idle (Cargo.lock restored afterwards). A re-check never delays real work:
// none starts while any lane has a job queued or running, and one running is killed (locks
// restored) the moment one arrives. A pass drops the entry; a test that did not run is judged
// once per trigger; a failure with none of its recorded paths still dirty is a real break, filed
// as `cap bug` in the repo and dropped.
//
// `addDeferred(cfg, entries)`, `listDeferred(cfg)`, `recheckDeferred(cfg, { fileBug })`.
// `fileBug({ cwd, text })` defaults to the kit's cap CLI; tests inject a stub.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stopRequested } from './control.mjs';
import { baselineCommand } from './attribute.mjs';
import { repoByName } from './config.mjs';
import { diagnose, testKey } from './diagnose.mjs';
import { dirtyPaths, lockFiles, revParse } from './git.mjs';
import { laneBusy } from './lane-busy.mjs';
import { logPathFor, ensureDirs } from './result.mjs';
import { recordRun } from './health-store.mjs';
import { guardLocks } from './preimage.mjs';
import { runCancellable } from './run-cancellable.mjs';

const file = (cfg) => join(ensureDirs(cfg).home, 'deferred.json');
const CAP = join(import.meta.dirname, '..', 'cap.mjs');
const same = (a, b) => a.repo === b.repo && testKey(a) === testKey(b);

/** One entry per test: a test stored twice (older brokers keyed on the command too) keeps its newest. */
export function listDeferred(cfg) {
  let list;
  try { list = JSON.parse(readFileSync(file(cfg), 'utf8')); } catch { return []; }
  return list.filter((e, i) => !list.slice(i + 1).some((later) => same(e, later)));
}
const save = (cfg, list) => writeFileSync(file(cfg), JSON.stringify(list, null, 2));

/** Forget every deferred test of `repo` that a run just saw pass: [{ binary, test }]. */
export function forgetPassed(cfg, repo, passed) {
  const list = listDeferred(cfg);
  const kept = list.filter((e) => !(e.repo === repo && passed.some((t) => testKey(t) === testKey(e))));
  if (kept.length !== list.length) save(cfg, kept);
}

/** Record foreign failures: [{ test, reason, cmd, repo, job, dirty, head }]; a repeat refreshes its entry. */
export function addDeferred(cfg, entries) {
  if (!entries.length) return;
  const list = listDeferred(cfg).filter((e) => !entries.some((n) => same(e, n)));
  save(cfg, [...list, ...entries.map((e) => ({ ...e, deferredAt: new Date().toISOString() }))]);
}

export function fileBugViaCap({ cwd, text, type = 'bug' }) {
  const r = spawnSync(process.execPath, [CAP, type, text], { cwd, encoding: 'utf8', windowsHide: true });
  return r.status === 0;
}

const bugText = (e, cwd) => `test ${e.test} fails on a clean committed tree (${cwd}); command: ${e.cmd}; failure: ${e.reason}`;

/** Re-run triggered deferred tests while the queue is idle. Returns { dropped, filed, kept, cancelled? }. */
export function recheckDeferred(cfg, { fileBug = fileBugViaCap, pollMs } = {}) {
  const out = { dropped: [], filed: [], kept: [] };
  let list = listDeferred(cfg);
  if (laneBusy(cfg) || stopRequested(cfg)) return out;
  const groups = new Map();
  for (const e of list) {
    const repo = repoByName(cfg, e.repo);
    if (!repo) continue;
    const cwd = join(cfg.root, repo.path);
    const dirty = new Set(dirtyPaths(cwd));
    if (e.head === revParse(cwd, 'HEAD') && e.dirty.every((p) => dirty.has(p))) continue;
    const key = `${e.repo}\0${e.cmd}`;
    groups.set(key, [...(groups.get(key) || []), { e, cwd, dirty }]);
  }
  let n = 0;
  for (const members of groups.values()) {
    if (laneBusy(cfg)) break;
    const { e: first, cwd } = members[0];
    const failures = members.map((m) => ({ binary: m.e.binary || null, test: m.e.test }));
    const logPath = logPathFor(cfg, 'deferred', n++);
    const startedAt = new Date().toISOString();
    const run = guardLocks(cfg, { id: 'deferred', cwd }, () => runCancellable(baselineCommand(first.cmd, failures), { cwd, targetDir: cfg.targetDir, logPath, jobs: cfg.jobs, testThreads: cfg.testThreads }, { shouldCancel: () => !!laneBusy(cfg) || stopRequested(cfg), pollMs }));
    if (run.cancelled) { out.cancelled = true; break; }
    recordRun(cfg, { id: 'deferred', repo: first.repo, kind: 'recheck', startedAt, entries: lockFiles(cwd).map((path) => ({ path, blob: null })) });
    const seen = diagnose(readFileSync(logPath, 'utf8'));
    const failed = new Set(seen.failed.map(testKey));
    const passed = new Set(seen.passed.map(testKey));
    for (const { e, dirty } of members) {
      const head = revParse(cwd, 'HEAD');
      if (passed.has(testKey(e))) { list = list.filter((x) => !same(x, e)); out.dropped.push(e.test); }
      else if (!failed.has(testKey(e)) || e.dirty.some((p) => dirty.has(p))) {
        out.kept.push(e.test);
        Object.assign(list.find((x) => same(x, e)), { head, dirty: e.dirty.filter((p) => dirty.has(p)) });
      } else {
        fileBug({ cwd, text: bugText(e, cwd) });
        list = list.filter((x) => !same(x, e));
        out.filed.push(e.test);
      }
    }
  }
  save(cfg, list);
  return out;
}

const REASON_MAX = 80;
const oneLine = (text) => { const t = String(text).replace(/\s+/g, ' ').trim(); return t.length > REASON_MAX ? `${t.slice(0, REASON_MAX - 1)}…` : t; };

/** `broker status` lines: a count, then one short line per deferred test. */
export function deferredLines(cfg) {
  const list = listDeferred(cfg);
  if (!list.length) return [];
  const waits = (e) => (e.dirty.length ? `${e.dirty.length} dirty path(s) to clean or a HEAD move` : 'a HEAD move');
  return [
    `deferred: ${list.length} foreign test(s) waiting; detail in deferred.json`,
    ...list.map((e) => `  ${e.test} [${e.repo}] ${oneLine(e.reason)} (job ${e.job}; waits on ${waits(e)})`),
  ];
}
