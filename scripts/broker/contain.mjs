// contain.mjs — a broker error while a job runs fails that job, never the daemon. An uncaught
// throw would end the daemon with jobs queued, and nothing restarts it until the next submit or
// wait. The tree is put back first: a journal past its commit finishes its landing (resume.mjs),
// any other journal is restored.
//
// `failOnError(cfg, ids, error, { onResult })` → the results written for the ids still queued.

import { recordFault } from './health-store.mjs';
import { readInflight, recoverInflight } from './preimage.mjs';
import { STATUS, queued, removeJob, writeResult } from './result.mjs';
import { resumeLanding } from './resume.mjs';

const STACK_LINES = 6;

export function failOnError(cfg, ids, error, { onResult = () => {} } = {}) {
  const journal = readInflight(cfg);
  const recovered = recoverInflight(cfg);
  const results = recovered && recovered.resume ? resumeLanding(cfg, recovered.resume, { onResult }) : [];
  const stack = String((error && error.stack) || error).split('\n').slice(0, STACK_LINES).join(' | ');
  recordFault(cfg, { kind: 'daemon-error', id: ids[0], detail: stack });
  const all = [...new Set([...ids, ...(journal ? [journal.id, ...(journal.members || [])] : [])])];
  for (const id of all.filter((x) => queued(cfg, x))) {
    const r = writeResult(cfg, { id, status: STATUS.FAILED, phase: 'broker', commands: [], gate: [], stale: [], foreign: [], landed: null, message: `broker error (the broker's fault, not the patch's; resubmit): ${stack}` });
    removeJob(cfg, id);
    onResult(r);
    results.push(r);
  }
  return results;
}
