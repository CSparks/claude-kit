// hand-write-detect and a checkout of an older commit (KIT-T1337): `git checkout <rev> -- <path>` and
// `git restore --source=<rev>` put committed content back, which is no hand write even when it differs from HEAD. A real
// shell write beside a git segment, or without one, is still flagged, and the PreToolUse scan still sees a redirect
// onto a source file.
// Run: node hooks/hand-write-restore-history.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, git, reporter } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';
import { shellSourceWrites } from './lib/shell-source-write.mjs';

const { ok, done } = reporter('hand-write-restore-history');

const NOT_GENERATOR = './run-tests.exe';
const LATER = 'export const a = 5;\n';
const NOVEL = 'export const a = 99;\n';
const SEED_A = 'export const a = 1;\n';

try {
  const { call, fresh } = handWriteHarness();
  const flagged = (r, file = 'src/a.mjs') => r.status === 2 && r.stderr.includes(file);
  const clean = (r) => r.status === 0 && !r.stderr.includes('HAND WRITE');

  // A repo whose HEAD moved on from the seed: a.mjs and b.mjs both differ from the seed commit.
  const advanced = () => {
    const d = fresh();
    const seed = git(['rev-parse', 'HEAD'], d).trim();
    writeFileSync(join(d, 'src', 'a.mjs'), LATER);
    writeFileSync(join(d, 'src', 'b.mjs'), 'export const b = 6;\n');
    git(['commit', '-q', '-am', 'later'], d);
    return { d, seed };
  };

  const viaDir = advanced();
  const dirRun = call(viaDir.d, 'S1', `git checkout ${viaDir.seed} -- src && ${NOT_GENERATOR}`, () => git(['checkout', viaDir.seed, '--', 'src'], viaDir.d));
  ok('KIT-T1337: git checkout <older rev> -- <dir> restoring committed content is not a hand write', clean(dirRun));

  const viaRestore = advanced();
  const restoreRun = call(viaRestore.d, 'S1', `git restore --source=${viaRestore.seed} -- src/a.mjs`, () => git(['restore', `--source=${viaRestore.seed}`, '--', 'src/a.mjs'], viaRestore.d));
  ok('KIT-T1337: git restore --source=<older rev> is not a hand write', clean(restoreRun));

  const redirected = advanced();
  const redirectRun = call(redirected.d, 'S1', `git status && ${NOT_GENERATOR}`, () => writeFileSync(join(redirected.d, 'src', 'a.mjs'), NOVEL));
  ok('KIT-T1337 control: new content written beside a git segment is still a hand write', flagged(redirectRun));

  const mixed = advanced();
  const mixedRun = call(mixed.d, 'S1', `git checkout ${mixed.seed} -- src/b.mjs && ${NOT_GENERATOR}`, () => {
    git(['checkout', mixed.seed, '--', 'src/b.mjs'], mixed.d);
    writeFileSync(join(mixed.d, 'src', 'a.mjs'), NOVEL);
  });
  ok('KIT-T1337 control: a checkout of one file does not excuse a hand write of another', flagged(mixedRun, 'src/a.mjs') && !mixedRun.stderr.includes('src/b.mjs'));

  const noGit = advanced();
  const noGitRun = call(noGit.d, 'S1', NOT_GENERATOR, () => writeFileSync(join(noGit.d, 'src', 'a.mjs'), SEED_A));
  ok('KIT-T1337 control: older committed content written with no git in the command is still a hand write', flagged(noGitRun));

  const crossFile = advanced();
  const crossRun = call(crossFile.d, 'S1', `git status && ${NOT_GENERATOR}`, () => writeFileSync(join(crossFile.d, 'src', 'a.mjs'), 'export const b = 2;\n'));
  ok('KIT-T1337 control: content committed for ANOTHER path is not a restore of this one', flagged(crossRun));

  const stashed = advanced();
  writeFileSync(join(stashed.d, 'src', 'a.mjs'), NOVEL);
  git(['stash', 'push', '--', 'src'], stashed.d);
  const popRun = call(stashed.d, 'S1', `git stash pop && ${NOT_GENERATOR}`, () => git(['stash', 'pop'], stashed.d));
  ok('KIT-T1337 control: content only a stash holds is not committed history', flagged(popRun));

  const sh = (command) => shellSourceWrites(command, { shell: 'bash' });
  ok('KIT-T1337 control: a redirect onto a source file is still a hit of the PreToolUse scan', sh('echo x > src/a.rs').some((h) => h.path === 'src/a.rs'));
  ok('KIT-T1337 control: a sed -i onto a source file is still a hit of the PreToolUse scan', sh('sed -i s/a/b/ src/a.rs').some((h) => h.path === 'src/a.rs'));
} finally {
  cleanup();
}

done();
