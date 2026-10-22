// baseline.mjs — the pre-patch run that attribution (attribute.mjs) compares a failure against,
// cached by tree state (KIT-T472). Workers revise against the same HEAD many times; each red
// revision used to restore the tree, rebuild and re-run the same filtered command on the same
// base. A key of the pre-patch tree state, the pins held during the run and the command
// reuses that base log, and the tree is only restored on a miss.
//
// `makeBaseline({ cfg, job, cwd, pre, held, enter, leave })` → `baseline(fn)` for runCommands:
//   pre    the pre-patch state (cache.mjs treeState plus { dirty, head }) taken before the patch was written
//   held   the pins that stay checked out during the baseline run
//   enter  puts the tree into its pre-patch state; leave puts the patch back.
// `fn(run)` gets `run(cmd, tag)` → a base log path; baseline returns fn's result with { dirty, head }.

import { existsSync } from 'node:fs';
import { cacheGet, cachePut, hashKey } from './cache.mjs';
import { logPathFor } from './result.mjs';
import { runCommand } from './run.mjs';

const NAME = 'baseline';

export function makeBaseline({ cfg, job, cwd, pre, held, enter, leave }) {
  const pinsKey = `pins ${JSON.stringify(held.map((p) => [p.path, p.sha]))}`;
  return (fn) => {
    let entered = false;
    const run = (cmd, tag) => {
      const key = hashKey([`repo ${job.repo}`, pre.tree, pinsKey, `cmd ${String(cmd).trim()}`]);
      const hit = cacheGet(cfg, NAME, key);
      if (hit && existsSync(hit.log)) return hit.log;
      if (!entered) { enter(); entered = true; }
      const log = logPathFor(cfg, job.id, tag);
      runCommand(cmd, { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs, testThreads: cfg.testThreads });
      cachePut(cfg, NAME, key, { job: job.id, log });
      return log;
    };
    try {
      const attributed = fn(run);
      return attributed ? { ...attributed, dirty: pre.dirty, head: pre.head } : attributed;
    } finally {
      if (entered) leave();
    }
  };
}
