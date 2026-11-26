// code-root (KIT-T1603): q's code verbs search the cwd's git repo when its only store is the unbounded catch-all; an
// adopted repo, an explicit --root and a folder outside every repo keep their roots.
// Run: node scripts/code-root.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV, adopted, cleanup, git, repo, reporter, tmpDir } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('code-root');
const same = (a, b) => !!a && !!b && realpathSync.native(a).toLowerCase() === realpathSync.native(b).toLowerCase();
const TOKEN = 'zqxCodeRootToken';

try {
  const unbounded = tmpDir('kit-unbounded-');
  mkdirSync(join(unbounded, '.ai'), { recursive: true });
  writeFileSync(join(unbounded, '.ai', 'config.yml'), 'ids:\n  key: "UB"\n');
  process.env.CLAUDE_KIT_UNBOUNDED_AI = join(unbounded, '.ai');
  const { codeRoot } = await import('./code-root.mjs');

  const plain = repo();
  mkdirSync(join(plain, 'src'), { recursive: true });
  writeFileSync(join(plain, 'src', 'a.ts'), `export const ${TOKEN} = true;\n`);
  git(['add', 'src/a.ts'], plain);
  const store = adopted(false);
  writeFileSync(join(store, '.ai', 'config.yml'), 'ids:\n  key: "ZZ"\n');
  const outside = tmpDir('kit-outside-');

  ok('a git repo with no .ai store resolves to its own repo, not the catch-all', same(codeRoot(plain), plain));
  ok('a subfolder of that repo resolves to the repo', same(codeRoot(join(plain, 'src')), plain));
  ok('control: an adopted repo keeps its own root', same(codeRoot(store), store));
  ok('control: an explicit --root wins', same(codeRoot(plain, store), store));
  ok('control: a folder outside every repo keeps the catch-all', same(codeRoot(outside), unbounded));

  const q = spawnSync(process.execPath, [join(import.meta.dirname, 'q.mjs'), 'code', TOKEN, '--no-db'], { cwd: plain, encoding: 'utf8', env: { ...ENV, CLAUDE_KIT_UNBOUNDED_AI: join(unbounded, '.ai') } });
  ok('q code in a repo with no .ai store finds the file', q.status === 0 && q.stdout.includes('src/a.ts'));
} finally {
  cleanup();
}
done();
