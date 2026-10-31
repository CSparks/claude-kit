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
//   since, clock  when the job's run began and the time source; onPhase('baseline' | 'run') marks the re-run's own phase.
// `fn(run)` gets `run(cmd, tag)` → a base log path; baseline returns fn's result with { dirty, head }.
// A re-run costs about what the failed command did, so once the job has run longer than the lane's measured p90 run
// time (timing-tuning.mjs, re-derived every tick; no limit until the lane has history) the baseline is skipped (a cached
// base log still answers) and baseline returns { skipped: <reason> }: the failure stays unattributed. The job still runs.

import { existsSync } from 'node:fs';
import { cacheGet, cachePut, hashKey } from './cache.mjs';
import { logPathFor } from './result.mjs';
import { runCommand } from './run.mjs';
import { tunedBaselineBudgetMs } from './timing-tuning.mjs';

const NAME = 'baseline';
const SKIPPED = Symbol('baseline skipped');
const SKIP_REASON = 'attribution skipped: the job has run longer than the lane\'s p90 run time (KIT-D121), so the failure was not re-run without the patch';

export function makeBaseline({ cfg, job, cwd, pre, held, enter, leave, onPhase = () => {}, since = Date.now(), clock = Date.now }) {
  const pinsKey = `pins ${JSON.stringify(held.map((p) => [p.path, p.sha]))}`;
  return (fn) => {
    let entered = false;
    const run = (cmd, tag) => {
      const key = hashKey([`repo ${job.repo}`, pre.tree, pinsKey, `cmd ${String(cmd).trim()}`]);
      const hit = cacheGet(cfg, NAME, key);
      if (hit && existsSync(hit.log)) return hit.log;
      if (!entered) {
        if (clock() - since > tunedBaselineBudgetMs(cfg)) throw SKIPPED;
        onPhase('baseline');
        enter();
        entered = true;
      }
      const log = logPathFor(cfg, job.id, tag);
      runCommand(cmd, { cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs, testThreads: cfg.testThreads });
      cachePut(cfg, NAME, key, { job: job.id, log });
      return log;
    };
    try {
      const attributed = fn(run);
      return attributed ? { ...attributed, dirty: pre.dirty, head: pre.head } : attributed;
    } catch (e) {
      if (e !== SKIPPED) throw e;
      return { skipped: SKIP_REASON };
    } finally {
      if (entered) { leave(); onPhase('run'); }
    }
  };
}
