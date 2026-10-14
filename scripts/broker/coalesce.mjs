// coalesce.mjs — run a job's cargo test targets as ONE nextest invocation (KIT-T483). Workers
// submit a target per command (`cargo t -p game --lib`, `cargo t -p game --test a`, …); run one by
// one, every command re-checks the build and the test binaries execute in series. With
// `runner: nextest`, commands that differ only in their target selectors merge into
// `cargo nextest run --no-fail-fast <shared args> <selectors…>`: one build, binaries in parallel.
//
// A command merges only when it is `cargo test|t` with at least one target selector and nothing
// after `--` (a test-name filter or harness flag keeps its own run). A group of one is left as
// written. The merged command takes the place of its group's first member.
//
// `coalesce(commands)` → [{ cmd, from: [original commands] | null }].

const SELECTOR_WITH_VALUE = new Set(['--test', '--bin', '--example', '--bench']);
const SELECTOR_FLAG = new Set(['--lib', '--bins', '--tests', '--examples', '--benches']);
const DROPPED_FLAG = new Set(['--no-fail-fast']);
const DROPPED_WITH_VALUE = new Set(['-j', '--jobs']);
const TEST_SUBS = new Set(['test', 't']);

// { key, selectors } for a mergeable command, or null.
function parse(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  if (toks[0] !== 'cargo' || !TEST_SUBS.has(toks[1]) || toks.includes('--')) return null;
  const shared = [];
  const selectors = [];
  for (let i = 2; i < toks.length; i++) {
    const t = toks[i];
    if (SELECTOR_WITH_VALUE.has(t) && toks[i + 1]) selectors.push(`${t} ${toks[++i]}`);
    else if (SELECTOR_FLAG.has(t)) selectors.push(t);
    else if (DROPPED_WITH_VALUE.has(t)) i++;
    else if (!DROPPED_FLAG.has(t)) shared.push(t);
  }
  return selectors.length ? { key: shared.join(' '), selectors } : null;
}

export function coalesce(commands) {
  const groups = new Map();
  const slots = [];
  for (const cmd of commands) {
    const p = parse(cmd);
    if (!p) { slots.push({ cmd, from: null }); continue; }
    if (!groups.has(p.key)) {
      const slot = { cmd, from: [], selectors: [] };
      groups.set(p.key, slot);
      slots.push(slot);
    }
    const g = groups.get(p.key);
    g.from.push(cmd);
    for (const s of p.selectors) if (!g.selectors.includes(s)) g.selectors.push(s);
  }
  for (const [key, g] of groups) {
    if (g.from.length < 2) { g.cmd = g.from[0]; g.from = null; }
    else g.cmd = ['cargo nextest run --no-fail-fast', key, ...g.selectors].filter(Boolean).join(' ');
    delete g.selectors;
  }
  return slots;
}
