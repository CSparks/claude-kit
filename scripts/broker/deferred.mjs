// deferred.mjs — foreign test failures are deferred, never forgotten (KIT-T271). Attribution
// (attribute.mjs) lets a job pass over a failure the patch did not cause; each such test lands
// here with the command, repo, job, reason and the hand-edited paths that were dirty. When the
// repo's HEAD moves or one of those paths turns clean, the broker re-runs only those tests on
// the live tree while idle (Cargo.lock restored afterwards): a pass drops the entry; a failure with none of its recorded paths
// still dirty is a real break, filed as `cap bug` in the repo and dropped.
//
// `addDeferred(cfg, entries)`, `listDeferred(cfg)`, `recheckDeferred(cfg, { fileBug })`.
// `fileBug({ cwd, text })` defaults to the kit's cap CLI; tests inject a stub.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { baselineCommand } from './attribute.mjs';
import { repoByName } from './config.mjs';
import { diagnose, testKey } from './diagnose.mjs';
import { dirtyPaths, revParse } from './git.mjs';
import { listQueue, logPathFor, ensureDirs } from './result.mjs';
import { guardLocks } from './preimage.mjs';
import { runCommand } from './run.mjs';

const file = (cfg) => join(ensureDirs(cfg).home, 'deferred.json');
const CAP = join(import.meta.dirname, '..', 'cap.mjs');
const same = (a, b) => a.repo === b.repo && testKey(a) === testKey(b) && a.cmd === b.cmd;

export function listDeferred(cfg) {
  try { return JSON.parse(readFileSync(file(cfg), 'utf8')); } catch { return []; }
}
const save = (cfg, list) => writeFileSync(file(cfg), JSON.stringify(list, null, 2));

/** Record foreign failures: [{ test, reason, cmd, repo, job, dirty, head }]; a repeat refreshes its entry. */
export function addDeferred(cfg, entries) {
  if (!entries.length) return;
  const list = listDeferred(cfg).filter((e) => !entries.some((n) => same(e, n)));
  save(cfg, [...list, ...entries.map((e) => ({ ...e, deferredAt: new Date().toISOString() }))]);
}

export function fileBugViaCap({ cwd, text }) {
  const r = spawnSync(process.execPath, [CAP, 'bug', text], { cwd, encoding: 'utf8', windowsHide: true });
  return r.status === 0;
}

const bugText = (e, cwd) => `test ${e.test} fails on a clean committed tree (${cwd}); command: ${e.cmd}; failure: ${e.reason}`;

/** Re-run triggered deferred tests while the queue is idle. Returns { dropped, filed, kept }. */
export function recheckDeferred(cfg, { fileBug = fileBugViaCap } = {}) {
  const out = { dropped: [], filed: [], kept: [] };
  let list = listDeferred(cfg);
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
    if (listQueue(cfg).length) break;
    const { e: first, cwd } = members[0];
    const failures = members.map((m) => ({ binary: m.e.binary || null, test: m.e.test }));
    const logPath = logPathFor(cfg, 'deferred', n++);
    guardLocks(cfg, { id: 'deferred', cwd }, () => runCommand(baselineCommand(first.cmd, failures), { cwd, targetDir: cfg.targetDir, logPath, jobs: cfg.jobs }));
    const seen = diagnose(readFileSync(logPath, 'utf8'));
    const failed = new Set(seen.failed.map(testKey));
    const passed = new Set(seen.passed.map(testKey));
    for (const { e, dirty } of members) {
      const head = revParse(cwd, 'HEAD');
      if (passed.has(testKey(e))) { list = list.filter((x) => !same(x, e)); out.dropped.push(e.test); }
      else if (!failed.has(testKey(e))) out.kept.push(e.test);
      else if (e.dirty.some((p) => dirty.has(p))) {
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

export const deferredLines = (cfg) => listDeferred(cfg).map((e) => `deferred: ${e.test} [${e.repo}] ${e.reason} (job ${e.job}; waits on ${e.dirty.length ? e.dirty.join(', ') : 'HEAD move'})`);
