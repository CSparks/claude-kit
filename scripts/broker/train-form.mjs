// train-form.mjs — which queued jobs ride the next build together (KIT-T482 item 1).
// The head of the queue takes along later jobs of the same repo, in submit order, up to
// `batch` members, when each one:
//   - carries operations (a test-only job measures the baseline, so it runs alone),
//   - holds no explicit `--pin`, touches no submodule path (a linked job, linked.mjs, lands alone), and
//     shares the head's --no-pin; a Cargo.toml / Cargo.lock edit rides like any file (its path is claimed, so
//     two jobs over one manifest never share a train) and the build's rewritten lock lands with that member,
//   - has no paired pin for its ticket (paired.mjs: its failures must stay suspect),
//   - passes admission (admit.mjs) and touches no path another member or an earlier skipped
//     job touches, so jobs over the same file keep their submit order.
// The head runs alone (null) when it is not trainable, fails admission, lands on a cached green
// run, or nothing joins it; the solo path then writes its result as before.
//
// `formTrain(cfg, head, queue, { skip })` → { repo, members: [{ job, cwd, plan, touched }] } | null.

import { admit } from './admit.mjs';
import { treeState } from './cache.mjs';
import { repoByName } from './config.mjs';
import { findGreen, greenKey } from './green.mjs';
import { jobCommands } from './job-commands.mjs';
import { pairedPins } from './paired.mjs';
import { implicitPins } from './pin.mjs';
import { splitLinked } from './linked.mjs';

const MANIFEST = /(^|\/)Cargo\.(toml|lock)$/;
const posix = (p) => String(p).replace(/\\/g, '/');
/** True for a Cargo.toml / Cargo.lock path. */
export const isManifestPath = (p) => MANIFEST.test(posix(p));
const rawPaths = (job) => (job.ops || []).map((o) => posix(o.path));

export const trainable = (cfg, job, head) => (job.ops || []).length > 0 && !(job.pins || []).length
  && !!job.noPin === !!head.noPin
  && !splitLinked(cfg, repoByName(cfg, job.repo) || {}, rawPaths(job)).subs.size;

function cachedGreen(cfg, repo, head, admitted) {
  const held = implicitPins(cfg, repo, admitted.cwd, head);
  if (held.error) return true;
  const key = greenKey({ repo: head.repo, pre: treeState(cfg, admitted.cwd), files: admitted.plan.files, commands: jobCommands(cfg, head), pins: held.pins });
  return !!findGreen(cfg, key);
}

export function formTrain(cfg, head, queue, { skip = () => false } = {}) {
  if (!(cfg.batch > 1) || !trainable(cfg, head, head)) return null;
  const repo = repoByName(cfg, head.repo);
  if (!repo) return null;
  const peers = queue.filter((j) => j.id !== head.id && j.repo === head.repo && !skip(j));
  if (!peers.some((j) => trainable(cfg, j, head))) return null;
  const first = admit(cfg, head, repo);
  if (!first.ok || pairedPins(first.cwd, head.base, head.ticket).length) return null;
  if (head.land && cachedGreen(cfg, repo, head, first)) return null;

  const members = [{ job: head, ...first }];
  const claimed = new Set(first.touched);
  const blocked = new Set();
  const clashes = (paths) => paths.some((p) => claimed.has(p) || blocked.has(p));
  const block = (paths) => { for (const p of paths) blocked.add(p); };
  for (const job of peers) {
    if (members.length >= cfg.batch) break;
    const raw = rawPaths(job);
    if (!trainable(cfg, job, head) || clashes(raw)) { block(raw); continue; }
    const a = admit(cfg, job, repo);
    if (!a.ok || clashes(a.touched) || pairedPins(a.cwd, job.base, job.ticket).length) { block([...raw, ...(a.touched || [])]); continue; }
    members.push({ job, ...a });
    for (const p of a.touched) claimed.add(p);
  }
  return members.length > 1 ? { repo, members } : null;
}
