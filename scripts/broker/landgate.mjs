// landgate.mjs — the landing gate (KIT-T472). With `land_gate: affected` a `--land` job runs a
// compile check of every target, the test targets its changed paths map to (affected.mjs), and
// the worker's own targeted commands; suite-shaped commands leave the gate and run on the suite
// cadence (suite.mjs). A path the map cannot place falls back to the job's full commands.
//
// A job that carries its own targeted commands (--test) runs those in place of the mapped tests (the affected
// set only fills in for a job with none, or a suite-shaped one, unless `affected.mandatory` is set); the compile
// check of every target runs first either way, so a landing cannot break a target its commands do not build (KIT-T677).
// The test run of every dependent of a touched crate follows in both cases, so a landing cannot break a crate downstream of
// the one its commands name (KIT-T719); a submodule's own dependents are left to its pre-push check and the nightly suite (KIT-T860).
// A crate in a
// nested workspace (a submodule's `rust/`) is tested with `cd <workspace> &&` in front.
//
// `landGate(cfg, cwd, job, files)` (the plan's Map path → { text }, text null = deleted) → null (run the job's commands as given) or
//   { commands, selection: { reasons, dropped } }.
// `affected.conformance` (a command: the framework conformance test every game runs) joins every landing that touches Rust
//   source or a manifest, whether its paths map or not, so a game cannot land a change that bypasses the framework's defaults.
// `isSuiteShaped(cmd, suite)` → true for a suite command (modulo -j / --no-fail-fast) or an
//   unfiltered `cargo test`.

import { join } from 'node:path';
import { selectAffected, splitSpecs } from './affected.mjs';
import { dependentsOf, readLock } from './cargo-lock.mjs';
import { jobCommands } from './job-commands.mjs';

const SOURCE = /\.(rs|toml)$/;
const withConformance = (cfg, commands, files) => (cfg.affected.conformance && [...files.keys()].some((p) => SOURCE.test(p)) ? [...new Set([...commands, cfg.affected.conformance])] : commands);

const SELECTORS = new Set(['--test', '--tests', '--lib', '--bin', '--bins', '--example', '--examples', '--doc', '--bench']);
const TAKES_VALUE = new Set(['-p', '--package', '--features', '-F', '--profile', '-j', '--jobs', '--target', '--manifest-path', '--config', '-Z', '--exclude']);
const TEST_SUBS = new Set(['test', 't']);
const SUITE_TEST_TARGETS = 8; // a command naming this many `--test` targets is a hand-built full suite

const normalize = (cmd) => {
  const toks = String(cmd).trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '-j' || toks[i] === '--jobs') { i++; continue; }
    if (toks[i] !== '--no-fail-fast') out.push(toks[i]);
  }
  return out.join(' ');
};

function unfilteredTest(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1 || !TEST_SUBS.has(toks[ci + 1])) return false;
  for (let i = ci + 2; i < toks.length; i++) {
    const t = toks[i];
    if (t === '--') return toks.length === i + 1 || toks.slice(i + 1).every((a) => a.startsWith('-'));
    if (SELECTORS.has(t)) return false;
    if (TAKES_VALUE.has(t)) { i++; continue; }
    if (!t.startsWith('-')) return false;
  }
  return true;
}

function enumeratedSuite(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  const ci = toks.indexOf('cargo');
  if (ci === -1 || !TEST_SUBS.has(toks[ci + 1])) return false;
  const sep = toks.indexOf('--');
  return toks.slice(ci, sep === -1 ? undefined : sep).filter((t) => t === '--test').length >= SUITE_TEST_TARGETS;
}

export function isSuiteShaped(cmd, suite) {
  const n = normalize(cmd);
  return suite.some((s) => normalize(s) === n) || unfilteredTest(cmd) || enumeratedSuite(cmd);
}

const inWorkspace = (dir) => (dir ? `cd ${dir} && ` : '');

const trimmed = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
const inSubmodule = (cfg, ws) => (cfg.repos || []).some((r) => r.submodule && (trimmed(ws) === trimmed(r.path) || trimmed(ws).startsWith(`${trimmed(r.path)}/`)));

// Crates the project's `suite` runs whole (`cargo test -p game`): that run is the suite, which belongs to the suite cadence.
function suiteCrates(suite) {
  const crates = new Set();
  for (const cmd of suite.filter(unfilteredTest)) {
    const toks = String(cmd).trim().split(/\s+/);
    toks.forEach((t, i) => { if (t === '-p' || t === '--package') crates.add(toks[i + 1]); });
  }
  return crates;
}

// Workspace crates that depend, through the workspace's Cargo.lock, on a touched crate: their whole test run follows the touched
// crate's mapped targets (KIT-D110). One command per workspace names every dependent, so cargo unifies features once and
// compiles each shared crate once; a command per crate gave each its own feature set and recompiled the shared crates (KIT-T801).
// A workspace without a lock yields none. A dependent the project's `suite` runs whole is not in the command: its full run
// is the suite (nightly), and a landing that ran it would exceed the five-minute ceiling (KIT-D104); it is returned as `deferred`.
// A workspace inside a submodule (a linked landing from the consumer) contributes no command: its dependents unify features apart
// from the job's own command and recompile the framework cold (KIT-T860); the submodule half is gated by its own pre-push
// check (linked.mjs) and its dependents run on the nightly suite, so they are `deferred` too. The same holds when the landing
// is the submodule's own (`ownSubmodule`: the job's repo is a submodule): its workspace is the framework, whose dependents
// are every crate downstream of a shared one such as the test kit, and their cold run costs a quarter hour (KIT-T1052).
function dependentTests(cfg, cwd, sel, ownSubmodule) {
  const commands = [];
  const deferred = [];
  const wholeSuite = suiteCrates(cfg.suite || []);
  const byWorkspace = new Map();
  for (const [name, ws] of sel.workspaces) byWorkspace.set(ws, [...(byWorkspace.get(ws) || []), name]);
  for (const [ws, names] of byWorkspace) {
    const lock = readLock(join(cwd, ws, 'Cargo.lock'));
    if (!lock) continue;
    const submodule = ownSubmodule || inSubmodule(cfg, ws);
    const all = [...dependentsOf(lock, names)].filter((dep) => !names.includes(dep) && !sel.crates.has(dep) && (lock.get(dep) || {}).local);
    const deps = all.filter((dep) => !wholeSuite.has(dep) && !submodule);
    deferred.push(...all.filter((dep) => !deps.includes(dep)));
    if (deps.length) commands.push(`${inWorkspace(ws)}${cfg.affected.test} ${deps.map((dep) => `-p ${dep}`).join(' ')}`);
  }
  return { commands, deferred };
}

// One crate's mapped tests: the plain targets in one command, and each folded binary's module filters in a command of
// its own, because a filter applies to every binary a command runs.
function crateTests(cfg, workspace, name, specs) {
  const { plain, areas } = splitSpecs(specs);
  const prefix = `${inWorkspace(workspace)}${cfg.affected.test} -p ${name}`;
  return [...(plain.length ? [`${prefix} ${plain.join(' ')}`] : []), ...[...areas].map(([area, filters]) => `${prefix} --test ${area} -- ${[...new Set(filters)].join(' ')}`)];
}

const WORKSPACE_FLAGS = new Set(['--workspace', '--all']);
const FEATURE_FLAGS = new Set(['--features', '-F']);
const withoutFeatures = (tokens) => tokens.filter((t, i) => !FEATURE_FLAGS.has(t) && !FEATURE_FLAGS.has(tokens[i - 1]));

// `affected.check` narrowed to `names`: --workspace becomes one -p per package; a command with none gets them at the end.
function narrowed(check, names, nested) {
  const tokens = String(check).trim().split(/\s+/);
  const scope = names.flatMap((n) => ['-p', n]);
  const at = tokens.findIndex((t) => WORKSPACE_FLAGS.has(t));
  const out = at === -1 ? [...tokens, ...scope] : [...tokens.slice(0, at), ...scope, ...tokens.slice(at + 1).filter((t) => !WORKSPACE_FLAGS.has(t))];
  return (nested ? withoutFeatures(out) : out).join(' ');
}

/**
 * The compile checks a landing runs under `land_gate: check` (KIT-T1115): `patch_check` touched = `affected.check` over the
 * packages the patch touches, one command per workspace (a nested workspace drops the superproject's --features); workspace, or a
 * path the map cannot place = the whole `affected.check`; off = none. Never a test.
 */
export function compileChecks(cfg, sel) {
  if (cfg.patchCheck === 'off') return [];
  if (cfg.patchCheck === 'workspace' || sel.unmapped.length) return [cfg.affected.check];
  const byWorkspace = new Map();
  for (const name of sel.crates.keys()) {
    const ws = sel.workspaces.get(name) || '';
    byWorkspace.set(ws, [...(byWorkspace.get(ws) || []), name]);
  }
  return [...byWorkspace].map(([ws, names]) => `${inWorkspace(ws)}${narrowed(cfg.affected.check, names, !!ws)}`);
}

const selectionOf = (cwd, files, cfg) => selectAffected(cwd, [...files.keys()], { deleted: [...files].filter(([, f]) => f.text === null).map(([p]) => p), match: cfg.affected.match });

/** The compile checks a landing of `files` needs under `land_gate: check` (patch.mjs: a landing that reuses a green check-only run). */
export const landChecks = (cfg, cwd, files) => (cfg.landGate === 'check' ? compileChecks(cfg, selectionOf(cwd, files, cfg)) : []);

// land_gate: check — the compile check, then only the commands the job names (or verify_default when the project set one).
function checkGate(cfg, job, files, sel) {
  const given = Array.isArray(job.commands) && job.commands.length ? job.commands : [];
  const dropped = given.filter((c) => isSuiteShaped(c, cfg.suite));
  const own = jobCommands(cfg, job).filter((c) => !dropped.includes(c));
  const commands = withConformance(cfg, [...new Set([...compileChecks(cfg, sel), ...own])], files);
  return { commands, selection: { reasons: sel.reasons, dropped, explicit: given.length > 0, check: cfg.patchCheck } };
}

export function landGate(cfg, cwd, job, files) {
  if (cfg.landGate !== 'affected' && cfg.landGate !== 'check') return null;
  const sel = selectionOf(cwd, files, cfg);
  if (cfg.landGate === 'check') return checkGate(cfg, job, files, sel);
  if (sel.unmapped.length) {
    const own = jobCommands(cfg, job);
    const commands = withConformance(cfg, own, files);
    return commands.length > own.length ? { commands, selection: { reasons: [], dropped: [], unmapped: sel.unmapped } } : null;
  }
  const given = Array.isArray(job.commands) && job.commands.length ? job.commands : [];
  const dropped = given.filter((c) => isSuiteShaped(c, cfg.suite));
  const kept = given.filter((c) => !dropped.includes(c));
  const ownSubmodule = (cfg.repos || []).some((r) => r.submodule && r.name === job.repo);
  const { commands: dependents, deferred: deferredDependents } = cfg.affected.dependents ? dependentTests(cfg, cwd, sel, ownSubmodule) : { commands: [], deferred: [] };
  if (kept.length && !cfg.affected.mandatory) return { commands: withConformance(cfg, [...new Set([cfg.affected.check, ...kept, ...dependents])], files), selection: { reasons: [], dropped, explicit: true, deferredDependents } };
  const tests = [...sel.crates].filter(([, specs]) => specs.size).flatMap(([name, specs]) => crateTests(cfg, sel.workspaces.get(name), name, specs));
  const commands = withConformance(cfg, [...new Set([cfg.affected.check, ...tests, ...dependents, ...kept])], files);
  return { commands, selection: { reasons: sel.reasons, dropped, deferredDependents } };
}
