// build-phase.mjs — a hold covers compilation, not the tests that follow it (KIT-T1056). While a held build compiles it
// keeps the cores it was granted. Once its process tree has no compiler for SETTLE_MS and a test process runs, the hold
// shrinks to what the tests use (measured CPU, at least RUN_MIN_CORES) and waiting builds are granted the rest. A compiler
// that reappears (the next test target builds) grows the hold back to the grant at once. Every poll also writes the phase,
// the live compiler count and the CPU the tree used into the hold, which `builds` prints.
//
//   phaseWatch({ slot, pid, list?, now?, pollMs?, settleMs? }) -> { poll() }
//     slot: an acquired slot (update(patch), granted); pid: the build's root process. poll() is cheap between samples.
//   readPhase(tree) -> { compiling, rustc, testing, cpuMs }   what a process tree is doing
//   chargeFor(cores, granted) -> cores a running-tests hold is charged

import { listProcesses } from './build-contention.mjs';
import { cpuByPid, cpuGain, isCompiler, treeOf } from './build-progress.mjs';

export const RUN_MIN_CORES = 2;
export const SETTLE_MS = 10000;
export const PHASE_POLL_MS = 5000;
const RUSTC = /^(rustc|rustdoc|clippy-driver)(\.exe)?$/i;
const INFRA = /^(cargo|cargo-nextest|nextest|rustup|node|cmd|conhost|sh|bash|powershell|pwsh|git|cl|mspdbsrv)(\.exe)?$/i;

export function readPhase(tree) {
  return {
    compiling: tree.some(isCompiler),
    rustc: tree.filter((r) => RUSTC.test(r.name || '')).length,
    testing: tree.some((r) => !isCompiler(r) && !INFRA.test(r.name || '')),
    cpuMs: tree.reduce((n, r) => n + (r.cpuMs || 0), 0),
  };
}

export const chargeFor = (cores, granted) => Math.min(granted, Math.max(RUN_MIN_CORES, Math.ceil(cores)));

export function phaseWatch({ slot, pid, list = listProcesses, now = Date.now, pollMs = PHASE_POLL_MS, settleMs = SETTLE_MS }) {
  let next = 0;
  let quietSince = null;
  let before = new Map();
  let beforeAt = 0;
  return {
    poll() {
      const at = now();
      if (at < next) return;
      next = at + pollMs;
      const tree = treeOf(list(), pid);
      if (!tree.length) return;
      const seen = readPhase(tree);
      const cores = beforeAt ? cpuGain(before, tree) / (at - beforeAt) : 0;
      before = cpuByPid(tree);
      beforeAt = at;
      if (seen.compiling) {
        quietSince = null;
        slot.update({ phase: 'compiling', rustc: seen.rustc, cpuMs: seen.cpuMs, cores, jobs: slot.granted });
      } else if (seen.testing) {
        quietSince ??= at;
        if (at - quietSince >= settleMs) slot.update({ phase: 'running', rustc: 0, cpuMs: seen.cpuMs, cores, jobs: chargeFor(cores, slot.granted) });
      }
    },
  };
}
