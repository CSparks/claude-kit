// hook-limits.mjs — the wall-clock limit of every hook run through compat-run (KIT-T1289).
//
//   hookLimitMs(script, env?) -> ms a hook may live, stdin read included
//
// A hook is a short gate: DEFAULT_LIMIT_MS. A hook that lists processes, fetches, pushes, lints or
// indexes declares the longer LONG_LIMIT_MS by name in LONG_HOOKS, kept under the 5-minute ceiling
// (KIT-D104). CLAUDE_KIT_HOOK_LIMIT_MS replaces both (tests shrink it).

export const DEFAULT_LIMIT_MS = 15000;
export const LONG_LIMIT_MS = 120000;
export const LIMIT_ENV = 'CLAUDE_KIT_HOOK_LIMIT_MS';

const LONG_HOOKS = new Set([
  'agent-roster.mjs',
  'code-graph.mjs',
  'commit-gate.mjs',
  'crate-check.mjs',
  'flush.mjs',
  'framework-pin.mjs',
  'git-pull-hydrate.mjs',
  'housekeeping.mjs',
  'hydrate-cache.mjs',
  'ingest-data.mjs',
  'jscpd.mjs',
  'lint.mjs',
  'orient.mjs',
  'orphan-reaper.mjs',
  'sync-data.mjs',
]);

export function hookLimitMs(script, env = process.env) {
  const override = Number(env[LIMIT_ENV]);
  if (override > 0) return override;
  return LONG_HOOKS.has(script) ? LONG_LIMIT_MS : DEFAULT_LIMIT_MS;
}
