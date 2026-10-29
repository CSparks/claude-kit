// submit-lib.mjs — turn a worker's envelope into a queued patch job, or into a `stale` result
// when its dry run against current HEAD misses (KIT-T276). Pure of process state so tests call
// it directly; submit.mjs is the CLI shell around it.

import { join } from 'node:path';
import { asList } from './cli.mjs';
import { repoByName } from './config.mjs';
import { parseEnvelope } from './envelope.mjs';
import { git, revParse } from './git.mjs';
import { planAtHead } from './plan.mjs';
import { linkedReader } from './linked.mjs';
import { laneRef } from './lane-ref.mjs';
import { jobSession } from './rr.mjs';
import { isSuiteShaped } from './landgate.mjs';
import { parentWorkspaceCommand } from './lane-cargo.mjs';

export const SUITE_REFUSAL = 'full suites run on the cadence; list the targets you touched (--test "cargo t -p <crate> --test <name>")';
import { parsePins } from './pin.mjs';
import { redRunRefusal } from './red-run.mjs';
import { readInflight } from './preimage.mjs';
import { staleEntries } from './admit.mjs';
import { STATUS, listQueue, newJobId, readResult } from './result.mjs';

// Files the daemon's in-flight run wrote into `cwd` that did not exist before it: a check-only
// run holds them until it restores, and a submit planned meanwhile must not read them as collisions.
function inflightCreated(cfg, cwd) {
  const journal = readInflight(cfg);
  return journal && journal.cwd === cwd ? journal.entries.filter((e) => e.blob === null).map((e) => e.path) : [];
}

function revisionOf(cfg, revises) {
  if (!revises) return 1;
  const prior = readResult(cfg, revises) || listQueue(cfg).find((j) => j.id === revises);
  return (prior?.revision || 1) + 1;
}

/** `flags['no-patch']` builds a test-only job (no operations, never landing). `flags['no-pin']`
 * lands a submodule commit without re-pinning; `flags.pin` (name=sha) pins a submodule for the job (pin.mjs).
 * { job } ready to queue, { result } when the dry run is stale, or { error } for a bad envelope. */
export function buildPatchJob(cfg, flags, text) {
  const repo = typeof flags.repo === 'string' ? repoByName(cfg, flags.repo) : cfg.repos.find((r) => !r.submodule) || cfg.repos[0];
  if (!repo) return { error: 'no such repo in .ai/config.yml broker.repos' };
  let ops = [];
  // A job that only moves a submodule pin carries no operations: an empty envelope or --no-patch with --pin.
  const pinOnly = !!flags.pin && (flags['no-patch'] || !String(text || '').trim());
  if (pinOnly) {
    // no operations; the gitlink is the whole change
  } else if (flags['no-patch']) {
    if (flags.land) return { error: '--no-patch cannot --land: a landing needs operations' };
  } else {
    try { ops = parseEnvelope(text); } catch (e) { return { error: e.message }; }
  }

  // Under the affected gate a worker job never runs the whole suite: it holds the one writer for
  // the suite's length (a 1,426 s check-only run blocked dirt-empire's queue for 24 min).
  const tests = asList(flags.test).map(String);
  if (cfg.landGate === 'affected' && tests.some((c) => isSuiteShaped(c, cfg.suite))) return { error: SUITE_REFUSAL };
  if (cfg.landGate === 'affected' && flags['no-patch'] && !tests.length) return { error: SUITE_REFUSAL };

  const red = redRunRefusal(cfg, flags.ticket ? String(flags.ticket) : null, flags.diagnosed);
  if (red) return { error: red };

  if (flags['no-pin'] && !repo.submodule) return { error: '--no-pin applies to a job whose --repo is a submodule' };
  if (flags.pin && repo.submodule) return { error: '--pin belongs on the superproject job, not on a submodule job' };
  const pinned = flags.pin ? parsePins(cfg, repo, flags) : { pins: [] };
  if (pinned.error) return { error: pinned.error };

  const cwd = join(cfg.root, repo.path);
  const outside = tests.map((c) => parentWorkspaceCommand(repo, cwd, c)).find(Boolean);
  if (outside) return { error: outside };
  const ref = laneRef(repo, cwd);
  const base = revParse(cwd, ref);
  const { plan } = planAtHead(cwd, ops, { ref, read: linkedReader(cfg, repo, cwd, ref), ownFiles: inflightCreated(cfg, cwd) });
  const meta = {
    id: newJobId(), revises: typeof flags.revises === 'string' ? flags.revises : null, repo: repo.name, base,
    ticket: flags.ticket ? String(flags.ticket) : null, title: flags.title ? String(flags.title) : '',
    session: jobSession(flags, process.env, join(cfg.root, '.ai')),
    ...(flags['auto-pin'] ? { autoPin: String(flags['auto-pin']) } : {}),
  };
  meta.revision = revisionOf(cfg, meta.revises);
  if (!plan.ok) {
    const stale = staleEntries(cwd, base, plan.stale);
    return { result: { ...meta, head: base, status: STATUS.STALE, phase: 'submit-dryrun', stale, gate: [], commands: [], landed: null } };
  }
  const files = Object.fromEntries([...plan.files.keys()].map((p) => [p, git(['rev-parse', `${ref}:${p}`], cwd).out || null]));
  return { job: { ...meta, ops, files, commands: tests, land: !!flags.land, pins: pinned.pins, noPin: !!flags['no-pin'] } };
}
