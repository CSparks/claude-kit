// coalesce.mjs — run a job's (or a train's) cargo test targets as ONE nextest invocation
// (KIT-T483, KIT-T482). Workers submit a target per command (`cargo t -p game --lib`,
// `cargo t -p ui --test a`, …); run one by one, every command re-checks the build and the test
// binaries execute in series. With `runner: nextest`, commands that differ only in their packages
// and target selectors merge into
// `cargo nextest run --no-fail-fast <shared args> -p a -p b <selectors…>`: one build over every
// package, binaries in parallel. cargo applies every selector to every named package, so a merge
// is exact only when it is a product: two commands merge when they name the same packages (their
// selectors union) or carry the same selectors (their packages union). `-p bike --lib` and
// `-p dirt-empire --test bike` differ in both and stay apart: merged, `--lib` would run the whole
// dirt-empire lib.
//
// A command merges only when it is `cargo test|t` with at least one target selector and nothing
// after `--` (a test-name filter or harness flag keeps its own run). Commands naming packages
// never merge with a workspace-wide one. A `cd <dir> &&` prefix leads the merged command and keeps its
// own group: commands for different workspaces never merge. A group of one is left as written. The merged command
// takes the place of its group's first member.
//
// A verb that is a cargo alias of the command's checkout (rapid-game: `t = nextest run --workspace
// --features rg-engine/dynamic_linking`) names the build's feature set. `cargo nextest run` without it
// is another feature set and a cold rebuild of the whole dependency stack (KIT-T649). Such commands merge
// only with commands of the same verb, and the merged command keeps that verb.
//
// `coalesce(commands, { cwd })` → [{ cmd, from: [original commands] | null }]; `cwd` is where the commands run.

import { aliasOf } from './alias.mjs';

const SELECTOR_WITH_VALUE = new Set(['--test', '--bin', '--example', '--bench']);
const SELECTOR_FLAG = new Set(['--lib', '--bins', '--tests', '--examples', '--benches']);
const DROPPED_FLAG = new Set(['--no-fail-fast']);
const DROPPED_WITH_VALUE = new Set(['-j', '--jobs']);
const PACKAGE = new Set(['-p', '--package']);
const TEST_SUBS = new Set(['test', 't']);

const ENTER = /^(cd\s+\S+\s*&&\s*)/;

const PLAIN_VERB = 'test';
const NEXTEST_RUN = 'nextest run';

// { key, enter, verb, shared, packages, selectors } for a mergeable command, or null.
function parse(text, cwd) {
  const enter = (ENTER.exec(String(text).trim()) || ['', ''])[1];
  const toks = String(text).trim().slice(enter.length).split(/\s+/);
  if (toks[0] !== 'cargo' || !TEST_SUBS.has(toks[1]) || toks.includes('--')) return null;
  const verb = aliasOf(text, cwd) ? toks[1] : PLAIN_VERB;
  const shared = [];
  const packages = [];
  const selectors = [];
  for (let i = 2; i < toks.length; i++) {
    const t = toks[i];
    if (SELECTOR_WITH_VALUE.has(t) && toks[i + 1]) selectors.push(`${t} ${toks[++i]}`);
    else if (SELECTOR_FLAG.has(t)) selectors.push(t);
    else if (PACKAGE.has(t) && toks[i + 1]) packages.push(toks[++i]);
    else if (DROPPED_WITH_VALUE.has(t)) i++;
    else if (!DROPPED_FLAG.has(t)) shared.push(t);
  }
  return selectors.length ? { enter, verb, key: `${enter}|${verb}|${shared.join(' ')}|${packages.length ? 'packages' : 'workspace'}`, shared, packages, selectors } : null;
}

const addAll = (into, list) => { for (const x of list) if (!into.includes(x)) into.push(x); };

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// The group a command joins without changing what runs: same packages, or same selectors.
const exactGroup = (candidates, p) => (candidates || []).find((g) => sameSet(g.packages, p.packages) || sameSet(g.selectors, p.selectors));

export function coalesce(commands, { cwd } = {}) {
  const byKey = new Map();
  const slots = [];
  for (const cmd of commands) {
    const p = parse(cmd, cwd);
    if (!p) { slots.push({ cmd, from: null }); continue; }
    let g = exactGroup(byKey.get(p.key), p);
    if (!g) {
      g = { cmd, from: [], enter: p.enter, verb: p.verb, shared: p.shared, packages: [], selectors: [] };
      byKey.set(p.key, [...(byKey.get(p.key) || []), g]);
      slots.push(g);
    }
    g.from.push(cmd);
    addAll(g.packages, p.packages);
    addAll(g.selectors, p.selectors);
  }
  for (const g of [...byKey.values()].flat()) {
    if (g.from.length < 2) { g.cmd = g.from[0]; g.from = null; }
    else {
      const run = g.verb === PLAIN_VERB ? NEXTEST_RUN : g.verb;
      g.cmd = `${g.enter}${[`cargo ${run} --no-fail-fast`, ...g.shared, ...g.packages.flatMap((p) => ['-p', p]), ...g.selectors].join(' ')}`;
    }
    delete g.enter;
    delete g.verb;
    delete g.shared;
    delete g.packages;
    delete g.selectors;
  }
  return slots;
}
