// subkit.mjs — a superproject fixture with a real `rapid-game` submodule and bare origins for both,
// for the submodule tests (pin.test.mjs, linked.test.mjs). NOT a test.

import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { addOrigin, cleanup, makeRepo, tempDir } from './testkit.mjs';

export const PASS = 'node -e "process.exit(0)"';

export function setup(extra = {}) {
  const subOriginDir = tempDir('pin-sub-bare-');
  const subSrc = makeRepo(tempDir('pin-sub-src-'));
  const subBare = addOrigin(subSrc, join(subOriginDir, 'sub.git')).replace(/\\/g, '/');
  const root = makeRepo(tempDir('pin-super-'));
  const superBareDir = tempDir('pin-super-bare-');
  const superBare = addOrigin(root, join(superBareDir, 'super.git'));
  g(['-c', 'protocol.file.allow=always', 'submodule', 'add', subBare, 'rapid-game'], root);
  g(['commit', '-m', 'add submodule'], root);
  g(['push', 'origin', 'main'], root);
  const sub = join(root, 'rapid-game');
  g(['checkout', 'main'], sub);
  for (const [k, v] of [['user.email', 'broker@test'], ['user.name', 'Broker Test'], ['commit.gpgsign', 'false']]) g(['config', k, v], sub);
  const cfg = normalizeBroker(root, {
    repos: [{ name: 'super', path: '.', main: 'main', remote: 'origin' }, { name: 'rapid-game', path: 'rapid-game', main: 'main', remote: 'origin', submodule: true, pin_in: '.' }],
    verify_default: [PASS], ...extra,
  });
  const run = (flags, env, commands = [PASS]) => {
    const out = buildPatchJob(cfg, flags, env);
    if (!out.job) return { out };
    writeJob(cfg, { ...out.job, commands });
    processOnce(cfg);
    return { out, r: readResult(cfg, out.job.id) };
  };
  return { root, sub, cfg, subBare, superBare, run, done: () => [root, subSrc, subOriginDir, superBareDir].forEach(cleanup) };
}
