// check-run.mjs — run a patch job in the broker's check tree (KIT-T698). The maintainer's checkout never holds a patch that
// has not passed:
//   check-only job: the whole job runs in the check tree; the live tree is not touched.
//   landing job:    the gate runs there first (patch.mjs `gated`, result kept private); only when it passed does the live
//                   run write the patch, reusing that evidence, and commit and push it.
// When the check tree cannot be prepared the job runs in the live tree, as before, and says so in the daemon log.
//
//   processChecked(cfg, job, repo, run) -> the processPatch return value; `run` is processPatch.

import { join } from 'node:path';
import { treeState } from './cache.mjs';
import { prepareCheckTree } from './check-tree.mjs';
import { withLive } from './live-patch.mjs';
import { STATUS, writeResult } from './result.mjs';

const privateResult = (cfg, result) => ({ finishedAt: new Date().toISOString(), ...result });

export function processChecked(cfg, job, repo, run) {
  const tree = cfg.checkTree ? prepareCheckTree(cfg, repo) : null;
  if (!tree || tree.error) {
    if (tree) console.error(`broker: check tree unavailable for ${repo.name} (${tree.error}); ${job.id} runs in the live checkout`);
    return withLive(cfg, job.id, tree ? 'check tree unavailable' : 'check tree off', () => run(cfg, job, repo));
  }
  const live = join(cfg.root, repo.path);
  const keyTree = () => treeState(cfg, live);
  if (!job.land) return run(tree.cfg, job, repo, { keyTree });
  const checked = run(tree.cfg, { ...job, land: false }, repo, { gated: true, keyTree, write: privateResult });
  if (checked.result.status !== STATUS.PASSED) {
    const { finishedAt, ...fields } = checked.result;
    return { result: writeResult(cfg, { ...fields, land: true }), pause: checked.pause };
  }
  return withLive(cfg, job.id, 'landing', () => run(cfg, job, repo));
}
