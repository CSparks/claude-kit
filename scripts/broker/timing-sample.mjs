// timing-sample.mjs — one timing sample per finished job or train (KIT-D121), derived on demand from the result
// files (phase timings, per-command queue and run milliseconds, cargo logs): history starts with the module.
// A sample splits the wall time into entries { kind, key, ms }:
//   phase  queue (machine build slot), compile, test, command, run-idle, and every other timed phase by name
//   crate  a command's queue + run time over the crates its `-p` names ('(workspace)' when none)
//   test   a test command's queue + run time under '<crate> --test <name>' / '<crate> --lib' / '<crate> (all tests)'
//   waste  work the change did not need (timing-waste.mjs)
//
//   sampleOf(members, { project, lane, bases }) -> { id, project, lane, at, turnaroundMs, jobs, entries, cache }
//   samplesFromResults(results, ctx)         -> samples, the members of one train counted once
//   laneSamples(cfg)                         -> samples of one lane's result files

import { basename, join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { commandSplit } from './metrics.mjs';
import { loadResults, submittedAt } from './stats.mjs';
import { movedPaths } from './timing-moved.mjs';
import { wasteOf } from './timing-waste.mjs';

export const PHASE = 'phase';
export const CRATE = 'crate';
export const TEST = 'test';
export const QUEUE = 'queue';
const WORKSPACE = '(workspace)';
const TEST_COMMAND = /\bcargo\b.*\b(?:test|t|nextest)\b/;
const PACKAGE_FLAGS = new Set(['-p', '--package']);
const TARGET_FLAGS = new Set(['--test', '--bin', '--example', '--bench']);

const argsOf = (cmd) => {
  const toks = String(cmd).trim().split(/\s+/);
  const sep = toks.indexOf('--');
  return sep === -1 ? toks : toks.slice(0, sep);
};

function cratesOf(cmd) {
  const args = argsOf(cmd);
  const named = args.flatMap((t, i) => (PACKAGE_FLAGS.has(args[i - 1]) ? [t] : []));
  return named.length ? named : [WORKSPACE];
}

function targetsOf(cmd) {
  const args = argsOf(cmd);
  const named = args.flatMap((t, i) => (TARGET_FLAGS.has(args[i - 1]) ? [`${args[i - 1]} ${t}`] : args[i] === '--lib' ? ['--lib'] : []));
  return named.length ? named : ['(all tests)'];
}

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

export function sampleOf(members, { project, lane, bases = [], moved = [] }) {
  const [first] = members;
  const commands = [...new Map(members.flatMap((m) => m.commands || []).map((c) => [c.log || c.cmd, c])).values()];
  const entries = new Map();
  const add = (kind, key, ms) => {
    if (!(ms > 0)) return;
    const id = `${kind}\0${key}`;
    entries.set(id, { kind, key, ms: (entries.get(id)?.ms || 0) + ms });
  };
  let accounted = 0;
  for (const c of commands) {
    const queue = c.slotWaitMs || 0;
    const ran = Number.isFinite(c.durationMs) ? c.durationMs : 0;
    const { build, test } = commandSplit(c);
    add(PHASE, QUEUE, queue);
    add(PHASE, 'compile', build);
    add(PHASE, TEST, test);
    add(PHASE, 'command', ran - build - test);
    accounted += queue + ran;
    const crates = cratesOf(c.cmd);
    for (const name of crates) add(CRATE, name, (queue + ran) / crates.length);
    const targets = TEST_COMMAND.test(c.cmd) ? targetsOf(c.cmd) : [];
    for (const name of crates) for (const target of targets) add(TEST, `${name} ${target}`, (queue + ran) / (crates.length * targets.length));
  }
  let runMs = 0;
  for (const t of first.timings || []) {
    if (t.phase === 'run') runMs += t.ms || 0;
    else add(PHASE, t.phase, t.ms);
  }
  add(PHASE, 'run-idle', runMs - accounted);
  const waste = wasteOf(commands, members, { bases, cratesOf, targetsOf, moved });
  for (const e of waste.entries) add(e.kind, e.key, e.ms);
  const turnarounds = members.map((m) => Date.parse(m.finishedAt) - submittedAt(m.id)).filter(Number.isFinite);
  return { id: first.train ? first.train.id : first.id, project, lane, at: Date.parse(first.finishedAt), turnaroundMs: mean(turnarounds), jobs: members.length, entries: [...entries.values()], cache: waste.cache };
}

// `ctx.movedBetween(prev, cur)` names the paths the base moved from the lane's previous job to this one.
export function samplesFromResults(results, ctx) {
  const groups = new Map();
  for (const r of [...results].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt))) {
    const key = r.train ? r.train.id : r.id;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  let previous = null;
  const samples = [];
  for (const members of groups.values()) {
    const moved = previous && ctx.movedBetween ? ctx.movedBetween(previous[0], members[0]) : [];
    samples.push(sampleOf(members, { ...ctx, moved }));
    previous = members;
  }
  return samples.filter((s) => Number.isFinite(s.at));
}

export const laneName = (cfg) => cfg.lane || 'root';

export function laneSamples(cfg) {
  const bases = [cfg.root, ...cfg.repos.map((r) => join(cfg.root, r.path || r.name))];
  const repoDir = (result) => join(cfg.root, cfg.repos.find((r) => r.name === result.repo)?.path || '.');
  const movedBetween = (prev, cur) => (prev.repo === cur.repo ? movedPaths(repoDir(cur), prev.base, cur.base) : []);
  return samplesFromResults(loadResults(brokerPaths(cfg).results), { project: basename(cfg.root), lane: laneName(cfg), bases, movedBetween });
}
