// admit.mjs — the checks a patch job passes before anything touches the tree: the checkout is
// free of hand edits that block it, its ops plan at HEAD, the pre-write gate accepts every file,
// and a landing names its ticket. The solo path (patch.mjs) and a train (train.mjs) share it.
//
// `admit(cfg, job, repo, { onPhase })` →
//   { ok: true, cwd, ops, plan, touched }                    the job may run
//   { ok: false, fields, pause? }                            result fields to write; pause leaves it queued

import { join } from 'node:path';
import { dirtState } from './dirty.mjs';
import { entriesText } from './hand-hold.mjs';
import { GATE_CRASH, RUNTIME_GONE, gatePlan } from './gate.mjs';
import { recordFault, recordGatePass } from './health-store.mjs';
import { logSince } from './git.mjs';
import { planAtHead } from './plan.mjs';
import { linkedReader } from './linked.mjs';
import { STATUS } from './result.mjs';

export function staleEntries(cwd, base, stale) {
  return stale.map((s) => ({ ...s, since: base ? logSince(cwd, base, s.path) : [] }));
}

const posix = (p) => String(p).replace(/[\\]/g, '/');

export function admit(cfg, job, repo, { onPhase = () => {} } = {}) {
  const cwd = join(cfg.root, repo.path);
  const refuse = (fields, pause = false) => ({ ok: false, fields, pause });
  onPhase('apply');
  const { ops, plan } = planAtHead(cwd, job.ops || [], { read: linkedReader(cfg, repo, cwd) });
  const touched = ops.map((o) => posix(o.path));
  const state = dirtState(cfg, repo, cwd, touched);
  if (!state.clean) {
    return refuse({ status: STATUS.DIRTY, phase: 'apply', dirtyEntries: state.entries, message: `build checkout dirty (${cwd}): ${entriesText(state.entries)} — queue paused until these are committed, reverted or stashed` }, true);
  }
  if (!plan.ok) return refuse({ status: STATUS.STALE, phase: 'apply', stale: staleEntries(cwd, job.base, plan.stale) });

  onPhase('gate');
  const gate = gatePlan(cwd, plan.files);
  const gone = gate.find((g) => g.check === RUNTIME_GONE);
  if (gone) return refuse({ status: STATUS.FAILED, phase: 'gate', gate, message: `${gone.msg} (the broker's fault, not the patch's; resubmit once it restarted)` });
  const crash = gate.find((g) => g.check === GATE_CRASH);
  if (crash) {
    recordFault(cfg, { kind: GATE_CRASH, id: job.id, detail: crash.msg });
    return refuse({ status: STATUS.FAILED, phase: 'gate', gate, message: `the gate crashed (the broker's fault, not the patch's): ${crash.msg}` });
  }
  recordGatePass(cfg);
  if (gate.length) return refuse({ status: STATUS.GATE, phase: 'gate', gate });

  if (job.land && !(job.ops || []).length && !(job.pins || []).length) return refuse({ status: STATUS.FAILED, phase: 'land', message: 'a landing needs operations or a --pin; a test-only job cannot --land' });
  if (job.land && !job.ticket) return refuse({ status: STATUS.FAILED, phase: 'land', message: 'a landing patch needs --ticket (the commit cites it)' });
  return { ok: true, cwd, ops, plan, touched };
}
