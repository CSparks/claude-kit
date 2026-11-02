// cold-worktree-build (KIT-T176, KIT-D074): any worktree dispatch is BLOCKED in any adopted repo, even with CARGO_TARGET_DIR
// or [cold-build-ok] in the brief; ALLOW only on [maintainer-asked-worktree: <his words>] or the ignore file. A hand-made
// worktree named in the brief counts; a submodule path does not.
// Run: node hooks/dispatch-cold-worktree.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, finish, ignoreFile, makeRepo, run, runRaw } from './dispatch-guard-harness.mjs';

const rust = makeRepo({ cargo: true });
const plain = makeRepo();
const wt = { subagent_type: 'general-purpose', model: 'opus', isolation: 'worktree', prompt: 'port the drill mesh (KIT-T176) [maintainer-words: "port the drill mesh"] [reuses: drill mesh port]' };

expect('blocks a worktree dispatch into a Cargo workspace', run(rust, wt).code, 2);
expect('blocks even when the brief provisions CARGO_TARGET_DIR (KIT-D039)', run(rust, { ...wt, prompt: 'port the drill mesh — export CARGO_TARGET_DIR=../main/target first' }).code, 2);
expect('blocks even with the retired [cold-build-ok: reason] token', run(rust, { ...wt, prompt: 'one-off audit [cold-build-ok: no cargo run needed]' }).code, 2);
expect('allows the [maintainer-asked-worktree: <his words>] escape', run(rust, { ...wt, prompt: 'demo [maintainer-asked-worktree: "put the demo in a worktree"]' }).code, 0);
expect('an empty [maintainer-asked-worktree:] does not escape', run(rust, { ...wt, prompt: 'demo [maintainer-asked-worktree: ]' }).code, 2);
expect('blocks a worktree dispatch in a non-Rust repo too (KIT-D074)', run(plain, wt).code, 2);
expect('allows the maintainer escape in a non-Rust repo', run(plain, { ...wt, prompt: 'x [maintainer-asked-worktree: "use a worktree here"]' }).code, 0);
expect('allows a non-worktree dispatch in a Cargo workspace', run(rust, { subagent_type: 'general-purpose', model: 'opus', prompt: 'x' }).code, 0);
expect('allows via the ignore file (cold-worktree-build)', run(ignoreFile(makeRepo({ cargo: true }), 'cold-worktree-build'), wt).code, 0);
expect('allows on malformed stdin with a Cargo repo (fail-open)', runRaw(rust, '{not json').code, 0);

const coldMsg = run(rust, wt).err;
expect('cold-build message cites KIT-D039 (one checkout on main)', /KIT-D039/.test(coldMsg) && /ONE checkout on main/.test(coldMsg) ? 1 : 0, 1);
expect('cold-build message no longer offers CARGO_TARGET_DIR as a fix', /CARGO_TARGET_DIR/.test(coldMsg) ? 1 : 0, 0);
expect('cold-build message names the maintainer escape token', /\[maintainer-asked-worktree:/.test(coldMsg) ? 1 : 0, 1);
expect('cold-build message carries the exclude footer', /id: cold-worktree-build/.test(coldMsg) ? 1 : 0, 1);

expect('allows on an unadopted repo with a Cargo.toml', run(makeRepo({ adopt: false, cargo: true }), wt).code, 0);

{
  const main = makeRepo({ cargo: true });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'seed'], { cwd: main });
  const wtDir = join(main, '..', `dg-wt-${process.pid}`);
  execFileSync('git', ['worktree', 'add', '-q', wtDir], { cwd: main });
  const named = { subagent_type: 'general-purpose', model: 'opus', prompt: `You work in the worktree \`${wtDir}\` (branch wt/x). Implement KIT-T256.` };
  expect('blocks a brief naming a hand-made worktree in a Cargo repo (cold build)', /cold-worktree-build/.test(run(main, named).err) ? 1 : 0, 1);
  {
    const plainMain = makeRepo();
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'seed'], { cwd: plainMain });
    const plainWt = join(plainMain, '..', `dg-wt-plain-${process.pid}`);
    execFileSync('git', ['worktree', 'add', '-q', plainWt], { cwd: plainMain });
    expect('blocks a brief naming a hand-made worktree in a non-Rust repo (KIT-D074)', run(plainMain, { ...named, prompt: `Work in \`${plainWt}\`.` }).code, 2);
  }
  expect('still blocks it with CARGO_TARGET_DIR provisioned (KIT-D039)', run(main, { ...named, prompt: `${named.prompt} Set CARGO_TARGET_DIR=${join(main, 'target')} first.` }).code, 2);

  // A submodule's .git is a file too (gitdir -> .git/modules/...); naming one is not a worktree dispatch.
  const sub = join(main, 'framework');
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, '.git'), 'gitdir: ../.git/modules/framework\n');
  expect('a brief naming a SUBMODULE path is not a worktree dispatch', /cold-worktree-build/.test(run(main, { ...named, prompt: `Repos: \`${main}\` + submodule \`${sub}\`. Implement KIT-T256.` }).err) ? 1 : 0, 0);
}

finish();
