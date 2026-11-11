// hand-write-detect and git restores (KIT-T982, KIT-T963, KIT-T977, KIT-T933): a file that git put back is no hand
// write. A file whose content now equals HEAD has no diff to gate; with git in the command, a file whose content an
// Edit or Write of any session left earlier was judged by pre-write when it was written. A real shell rewrite is
// still flagged beside both.
// Run: node hooks/hand-write-restore.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, git, reporter } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';

const { ok, done } = reporter('hand-write-restore');

const NOT_GENERATOR = './run-tests.exe';
const HAND = "fs.writeFileSync(p, 'export const a = 9;\\n')";
const EDITED = 'export const a = 7;\n';

try {
  const { spawnHook, call, fresh, rewrite } = handWriteHarness();
  const flagged = (r, file = 'src/a.mjs') => r.status === 2 && r.stderr.includes(file);
  const clean = (r) => r.status === 0 && !r.stderr.includes('HAND WRITE');

  const edit = (d, session, rel, text) => {
    const input = { session_id: session, tool_input: { file_path: join(d, rel), content: text } };
    spawnHook('pre-write.mjs', input, d);
    writeFileSync(join(d, rel), text);
    spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} }, d);
  };

  const reverted = fresh();
  rewrite(reverted, HAND);
  const viaCheckout = call(reverted, 'S1', `git checkout -- src/a.mjs && ${NOT_GENERATOR}`, () => git(['checkout', '--', 'src/a.mjs'], reverted));
  ok('KIT-T977, KIT-T933: git checkout restoring committed content inside a mixed command is not a hand write', clean(viaCheckout));

  const hand = fresh();
  const viaHand = call(hand, 'S1', `git status && ${NOT_GENERATOR}`, () => rewrite(hand, HAND));
  ok('KIT-T977 control: a rewrite to new content beside a git segment is still a hand write', flagged(viaHand));

  const copied = fresh();
  const viaCopy = call(copied, 'S1', `git status && ${NOT_GENERATOR}`, () => writeFileSync(join(copied, 'src', 'a.mjs'), 'export const b = 2;\n'));
  ok('KIT-T933 control: content equal to ANOTHER file at HEAD is not a restore of this one', flagged(viaCopy));

  const stashed = fresh();
  edit(stashed, 'S1', 'src/a.mjs', EDITED);
  const viaPush = call(stashed, 'S1', `git stash push -- src && ${NOT_GENERATOR}`, () => git(['stash', 'push', '--', 'src'], stashed));
  ok('KIT-T963: git stash push leaving the file at HEAD is not a hand write', clean(viaPush));
  const viaPop = call(stashed, 'S1', `git stash pop && ${NOT_GENERATOR}`, () => git(['stash', 'pop'], stashed));
  ok('KIT-T982, KIT-T963: git stash pop restoring the content an Edit left is not a hand write', clean(viaPop));

  const piped = fresh();
  edit(piped, 'S1', 'src/a.mjs', EDITED);
  git(['stash', 'push', '--', 'src'], piped);
  const viaPipe = call(piped, 'S1', 'git stash pop | Select-Object -Last 3', () => git(['stash', 'pop'], piped));
  ok('KIT-T982: a stash pop piped into a PowerShell cmdlet is not a hand write', clean(viaPipe));

  const handStash = fresh();
  rewrite(handStash, HAND);
  git(['stash', 'push', '--', 'src'], handStash);
  const viaHandPop = call(handStash, 'S1', `git stash pop && ${NOT_GENERATOR}`, () => git(['stash', 'pop'], handStash));
  ok('KIT-T982 control: popping content no Edit or Write ever left is still a hand write', flagged(viaHandPop));

  const noGit = fresh();
  edit(noGit, 'S1', 'src/a.mjs', EDITED);
  rewrite(noGit, HAND);
  const viaReplay = call(noGit, 'S1', NOT_GENERATOR, () => writeFileSync(join(noGit, 'src', 'a.mjs'), EDITED));
  ok('KIT-T982 control: without git in the command, content an earlier Edit left is not an exemption (KIT-T949)', flagged(viaReplay));

  const mixedFiles = fresh();
  edit(mixedFiles, 'S1', 'src/a.mjs', EDITED);
  rewrite(mixedFiles, HAND);
  const viaMixed = call(mixedFiles, 'S1', `git checkout -- src/b.mjs && ${NOT_GENERATOR}`, () => writeFileSync(join(mixedFiles, 'src', 'b.mjs'), 'export const b = 9;\n'));
  ok('control: a restore of one file does not excuse a hand write of another', flagged(viaMixed, 'src/b.mjs') && !viaMixed.stderr.includes('src/a.mjs'));
} finally {
  cleanup();
}

done();
