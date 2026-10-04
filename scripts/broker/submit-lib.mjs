// submit-lib.mjs — turn a worker's envelope into a queued patch job, or into a `stale` result
// when its dry run against current HEAD misses (KIT-T276). Pure of process state so tests call
// it directly; submit.mjs is the CLI shell around it.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dryRun } from './apply.mjs';
import { asList } from './cli.mjs';
import { repoByName } from './config.mjs';
import { parseEnvelope } from './envelope.mjs';
import { git, revParse, showFile } from './git.mjs';
import { parsePins } from './pin.mjs';
import { staleEntries } from './patch.mjs';
import { STATUS, listQueue, newJobId, readResult } from './result.mjs';

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
  if (flags['no-patch']) {
    if (flags.land) return { error: '--no-patch cannot --land: a landing needs operations' };
  } else {
    try { ops = parseEnvelope(text); } catch (e) { return { error: e.message }; }
  }

  if (flags['no-pin'] && !repo.submodule) return { error: '--no-pin applies to a job whose --repo is a submodule' };
  if (flags.pin && repo.submodule) return { error: '--pin belongs on the superproject job, not on a submodule job' };
  const pinned = flags.pin ? parsePins(cfg, repo, flags) : { pins: [] };
  if (pinned.error) return { error: pinned.error };

  const cwd = join(cfg.root, repo.path);
  const base = revParse(cwd, 'HEAD');
  const plan = dryRun(ops, (p) => showFile(cwd, 'HEAD', p), { onDisk: (p) => existsSync(join(cwd, p)) });
  const meta = {
    id: newJobId(), revises: typeof flags.revises === 'string' ? flags.revises : null, repo: repo.name, base,
    ticket: flags.ticket ? String(flags.ticket) : null, title: flags.title ? String(flags.title) : '',
  };
  meta.revision = revisionOf(cfg, meta.revises);
  if (!plan.ok) {
    const stale = staleEntries(cwd, base, plan.stale);
    return { result: { ...meta, head: base, status: STATUS.STALE, phase: 'submit-dryrun', stale, gate: [], commands: [], landed: null } };
  }
  const files = Object.fromEntries([...plan.files.keys()].map((p) => [p, git(['rev-parse', `HEAD:${p}`], cwd).out || null]));
  return { job: { ...meta, ops, files, commands: asList(flags.test).map(String), land: !!flags.land, pins: pinned.pins, noPin: !!flags['no-pin'] } };
}
