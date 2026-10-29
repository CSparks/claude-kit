// tree-apply.mjs — put a job's patch into a broker-owned tree (KIT-D115). The precheck and the measurement lane
// write the patch where nothing else reads it: planned against the tree's HEAD, then written.
//
//   applyPatch(treeCfg, repo, cwd, job) -> { ok: true, files } | { ok: false, stale }   `files` is the plan's Map path → { text }

import { linkedReader } from './linked.mjs';
import { planAtHead } from './plan.mjs';
import { writePlan } from './write-plan.mjs';

export function applyPatch(treeCfg, repo, cwd, job) {
  const { plan } = planAtHead(cwd, job.ops || [], { read: linkedReader(treeCfg, repo, cwd) });
  if (!plan.ok) return { ok: false, stale: plan.stale };
  writePlan(cwd, plan.files);
  return { ok: true, files: plan.files };
}
