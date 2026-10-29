// patch-worker-discipline — a dispatch check for dispatch-guard (KIT-T687). In a brokered repo every
// patch-worker feeds the one queue, and the queue is cores, not locks: too many workers, workers
// over the same files and workers that pin by hand each cost the lane a build. The check:
//   - caps live patch-workers per checkout at `broker.writer_cap` (default 3);
//   - requires `[paths: a, b]` in the brief (`[paths: *]` = unknown, overlaps everyone) and refuses a brief whose
//     paths overlap a live worker's, because jobs over one file never share a train;
//   - on an allowed dispatch, prints the train rules and warns when the brief tells the worker to pin.
//
//   workerBlock({ tree, input, prompt, live, cfg, escaped, footer }) -> block message | null
//   workerAdvice({ input, prompt, cfg })                              -> advisory text | null
//   overlaps(a, b)                                                    -> do two path lists touch the same file or directory
//
// Escape: the maintainer's `[maintainer-asked-parallel: <words>]` (passed in as `escaped`).

import { declaredPaths } from './dispatch-broker.mjs';

export const WORKER_CHECK = 'patch-worker-discipline';
const PATCH_WORKER = /(?:^|:)patch-worker$/i;
const PIN_TELL = /--pin\b|\bpin\b[^.\n]{0,60}\b(?:rapid-game|submodule)\b|\b(?:rapid-game|submodule)\b[^.\n]{0,60}\bpin\b/i;
export const DEFAULT_WRITER_CAP = 3;
export const TRAIN_RULES = [
  'Train rules for this worker (one build carries every disjoint queued patch):',
  '  - no hand --pin where auto_pin is on: the broker pins the consumer after a submodule landing;',
  '  - a Cargo.toml / Cargo.lock edit rides in the same job as the code that needs it;',
  '  - patches touch disjoint files; check-only first, then --land; the queue is not a compiler.',
];

const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
const touches = (a, b) => a === '*' || b === '*' || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

export function overlaps(a, b) {
  const left = (a || []).map(norm);
  const right = (b || []).map(norm);
  return left.some((x) => right.some((y) => touches(x, y)));
}

/** The paths a brief declares (`[paths: *]` = ['*']), or null when it declares none. */
export const workerPaths = (prompt, tree) => declaredPaths(prompt, tree) || (/\[paths:\s*\*\s*\]/i.test(String(prompt || '')) ? ['*'] : null);

const isWorker = (input) => PATCH_WORKER.test(String(input.subagent_type || input.agent_type || '').trim());

export function workerBlock({ tree, input, prompt, live, cfg, escaped, footer }) {
  if (!cfg || !isWorker(input) || escaped) return null;
  const cap = cfg.writerCap || DEFAULT_WRITER_CAP;
  const mine = workerPaths(prompt, tree);
  const problems = [];
  if (live.length >= cap) problems.push(`${live.length} patch-workers are already in flight here (cap ${cap}, broker.writer_cap in .ai/config.yml); collect one before dispatching another.`);
  if (!mine) problems.push('the brief declares no [paths: a, b]; name the files this worker will patch (or [paths: *] when unknown, which serialises it against every other worker).');
  else {
    const clash = live.find((r) => overlaps(mine, r.paths));
    if (clash) problems.push(`its [paths:] overlap in-flight worker ${clash.id} (${(clash.paths || []).join(', ')}); jobs over one file never share a train. Wait for it or split the files.`);
  }
  if (!problems.length) return null;
  return [
    'BLOCKED: patch-worker dispatch breaks the broker discipline (KIT-T687).',
    `  agent: ${String(input.subagent_type || input.agent_type)}   tree: ${tree}`,
    ...problems.map((p) => `  - ${p}`),
    '',
    ...TRAIN_RULES,
    'Only on the maintainer words: include [maintainer-asked-parallel: <his words>] in the prompt.',
    '',
    footer,
  ].join('\n');
}

export function workerAdvice({ input, prompt, cfg }) {
  if (!cfg || !isWorker(input)) return null;
  const lines = [...TRAIN_RULES];
  const pins = cfg.repos.some((r) => r.autoPin) && PIN_TELL.test(String(prompt || ''));
  if (pins) lines.push('WARNING: this brief tells the worker to pin, and auto_pin is on for a repo here: a hand --pin keeps the job out of every train. Drop the instruction.');
  return lines.join('\n');
}
