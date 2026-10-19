// default-state.mjs — the test files that assert where the kit keeps its DB, code index and cache by
// default (KIT-T570). The pool cannot hand them a private CLAUDE_KIT_DB without breaking what they
// check, so they run alone, one after another, once the pool is done; every other path is still private.

export const DEFAULT_STATE_TESTS = [
  'scripts/hydrate-at-source.test.mjs',
  'scripts/id-collision.test.mjs',
  'scripts/store-guard.test.mjs',
  'scripts/t.test.mjs',
];
