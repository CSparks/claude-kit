// compat-launcher.test.mjs — KIT-T460: the stable hook launcher (compat-run.mjs) loads the hook
// machinery from the sealed runtime's `current`, whatever the plugin root is, so a half-edited
// working tree never runs as a hook. --live / CLAUDE_KIT_LIVE=1 select the working tree.
// Run: node hooks/compat-launcher.test.mjs

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { HOOKS, cleanup, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('compat-launcher');

const core = (label) => `export async function main() { console.log('${label}:' + process.argv.slice(2).join(',')); }\n`;
const BROKEN = 'export async function main( {{ half-edit\n';

try {
  const tree = tmpDir('kit-launch-tree-');
  const runtime = tmpDir('kit-launch-rt-');
  const liveHooks = join(tree, 'hooks');
  const sealedHooks = join(runtime, 'current', 'hooks');
  mkdirSync(liveHooks, { recursive: true });
  mkdirSync(sealedHooks, { recursive: true });
  copyFileSync(join(HOOKS, 'compat-run.mjs'), join(liveHooks, 'compat-run.mjs'));
  copyFileSync(join(HOOKS, 'compat-run.mjs'), join(sealedHooks, 'compat-run.mjs'));
  writeFileSync(join(sealedHooks, 'compat-core.mjs'), core('sealed'));

  const run = (args = ['pre-write.mjs'], env = {}, launcher = join(liveHooks, 'compat-run.mjs')) => {
    const r = spawnSync(process.execPath, [launcher, ...args], {
      encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_RUNTIME: runtime, CLAUDE_KIT_LIVE: '', ...env },
    });
    return { code: r.status, out: (r.stdout || '').trim(), err: r.stderr || '' };
  };

  writeFileSync(join(liveHooks, 'compat-core.mjs'), BROKEN);
  const sealed = run();
  ok('a broken working-tree core never runs: the published core answers', sealed.code === 0 && sealed.out === 'sealed:pre-write.mjs', `${sealed.code} ${sealed.out} ${sealed.err}`);

  writeFileSync(join(liveHooks, 'compat-core.mjs'), core('live'));
  ok('the published core wins over a good working-tree core', run().out === 'sealed:pre-write.mjs');
  ok('--live selects the working tree and is not passed on', run(['--live', 'pre-write.mjs']).out === 'live:pre-write.mjs');
  ok('CLAUDE_KIT_LIVE=1 selects the working tree', run(['pre-write.mjs'], { CLAUDE_KIT_LIVE: '1' }).out === 'live:pre-write.mjs');
  ok('with no published runtime the working tree runs', run(['pre-write.mjs'], { CLAUDE_KIT_RUNTIME: join(runtime, 'absent') }).out === 'live:pre-write.mjs');

  writeFileSync(join(sealedHooks, 'compat-core.mjs'), BROKEN);
  ok('an unloadable published core falls back to the working tree', run().out === 'live:pre-write.mjs');
  writeFileSync(join(sealedHooks, 'compat-core.mjs'), core('sealed'));

  ok('started from inside the runtime it runs the runtime core', run(['pre-write.mjs'], {}, join(sealedHooks, 'compat-run.mjs')).out === 'sealed:pre-write.mjs');

  // the real core through the real launcher, from a stub plugin root with a broken hook beside it
  const real = tmpDir('kit-launch-real-');
  const realRuntime = join(real, 'rt');
  mkdirSync(join(realRuntime, 'current'), { recursive: true });
  const realRun = spawnSync(process.execPath, [join(HOOKS, 'compat-run.mjs'), '../etc.mjs'], {
    encoding: 'utf8', input: '{}', env: { ...process.env, CLAUDE_KIT_RUNTIME: realRuntime, CLAUDE_KIT_LIVE: '' },
  });
  ok('the real core still validates the hook name', realRun.status === 1 && /invalid hook script/.test(realRun.stderr), realRun.stderr);
} finally {
  cleanup();
}
done();
