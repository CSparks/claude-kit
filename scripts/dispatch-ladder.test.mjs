// dispatch-ladder.test.mjs — KIT-T326 / KIT-D079: the ladder resolves from the kit config only;
// a project `dispatch:` block changes nothing and is flagged as drift (in orient).
// Run: node scripts/dispatch-ladder.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLadder, resolveTier, dispatchDrift, KIT_ROOT } from './dispatch-ladder.mjs';
import { adopted, hook, git, cleanup, reporter } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('dispatch-ladder');
const FORKED = 'dispatch:\n  tiers:\n    standard: { model: claude-opus-4-8, effort: high }\n  default_tier:\n    "*": standard\n';

function withDispatch(dir) {
  writeFileSync(join(dir, '.ai', 'config.yml'), `${FORKED}\n`, { flag: 'a' });
  git(['add', '-A'], dir);
}

try {
  const before = resolveTier({ type: 'bug' });
  ok('standard tier resolves to the kit ladder (sonnet-5-5)', before.model === 'claude-sonnet-5-5' && before.effort === 'high');
  ok('a ticket type maps through default_tier; `*` is the catch-all',
    resolveTier({ type: 'regression' }).tier === 'forensic' && resolveTier({ type: 'unknown-type' }).tier === 'standard');
  ok('an explicit tier wins over the type', resolveTier({ type: 'bug', tier: 'deep' }).tier === 'deep');
  ok('fallback is carried for fable tiers', resolveTier({ tier: 'asset' }).fallback === 'claude-opus-5');
  ok('an off-ladder tier throws', (() => { try { resolveTier({ tier: 'nope' }); return false; } catch { return true; } })());
  ok('the ladder has the full tier set', ['light', 'standard', 'push', 'deep', 'max'].every((t) => t in readLadder().tiers));

  const proj = adopted(false);
  ok('a project without a dispatch block has no drift', dispatchDrift(proj) === null);
  withDispatch(proj);
  const after = resolveTier({ type: 'bug' });
  ok('a project dispatch block does not change the resolved tier', JSON.stringify(after) === JSON.stringify(before));
  ok('the project dispatch block is flagged as drift', /ignored/.test(dispatchDrift(proj) || ''));
  ok('the kit checkout never flags itself', dispatchDrift(KIT_ROOT) === null);

  const r = hook('orient.mjs', { hook_event_name: 'SessionStart' }, proj);
  ok('orient surfaces the drift warning', r.out.includes('`dispatch:` block — ignored'));
} finally {
  cleanup();
}
done();
