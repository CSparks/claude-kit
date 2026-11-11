// hand-write-detect and git restores (KIT-T982, KIT-T963, KIT-T977, KIT-T933): a file that git put back is no hand
// write. A file whose content now equals HEAD has no diff to gate; with git in the command, a file whose content an
// Edit or Write of any session left earlier was judged by pre-write when it was written; a byte-identical git
// rename (R100, KIT-T991) is a move, neither flagged nor held by the commit gate. A real shell rewrite is
// still flagged beside all three.
// Run: node hooks/hand-write-restore.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, git, reporter, tmpDir } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';

const { ok, done } = reporter('hand-write-restore');

const NOT_GENERATOR = './run-tests.exe';
const HAND = "fs.writeFileSync(p, 'export const a = 9;\\n')";
const EDITED = 'export const a = 7;\n';

try {
  const { state, spawnHook, call, commit, fresh, rewrite } = handWriteHarness();
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

  const neverStored = fresh();
  edit(neverStored, 'S1', 'src/a.mjs', EDITED);
  rewrite(neverStored, HAND);
  const viaUnstored = call(neverStored, 'S1', `git status && ${NOT_GENERATOR}`, () => writeFileSync(join(neverStored, 'src', 'a.mjs'), EDITED));
  ok('KIT-T982 control: Edit content git never stored (no stash, index or commit holds it) is not a restore, git in the command or not', flagged(viaUnstored));

  const moved = fresh();
  const viaMove = call(moved, 'S1', 'mkdir -p legacy && for f in a b; do git mv src/$f.mjs legacy/$f.mjs; done', () => {
    mkdirSync(join(moved, 'legacy'));
    git(['mv', 'src/a.mjs', 'legacy/a.mjs'], moved);
    git(['mv', 'src/b.mjs', 'legacy/b.mjs'], moved);
  });
  ok('byte-identical git mv renames (R100) in a loop with a mkdir are no hand write', clean(viaMove));

  const movedEdited = fresh();
  const viaMoveEdit = call(movedEdited, 'S1', 'mkdir -p legacy && git mv src/a.mjs legacy/a.mjs', () => {
    mkdirSync(join(movedEdited, 'legacy'));
    git(['mv', 'src/a.mjs', 'legacy/a.mjs'], movedEdited);
    writeFileSync(join(movedEdited, 'legacy', 'a.mjs'), 'export const a = 9;\n');
  });
  ok('control: a git mv followed by a shell edit of the destination is still a hand write', flagged(viaMoveEdit, 'legacy/a.mjs'));

  const movedStaged = fresh();
  const viaMoveStaged = call(movedStaged, 'S1', 'mkdir -p legacy && git mv src/a.mjs legacy/a.mjs', () => {
    mkdirSync(join(movedStaged, 'legacy'));
    git(['mv', 'src/a.mjs', 'legacy/a.mjs'], movedStaged);
    writeFileSync(join(movedStaged, 'legacy', 'a.mjs'), 'export const a = 1;\nexport const z = 3;\n');
    git(['add', 'legacy/a.mjs'], movedStaged);
  });
  ok('control: a rename staged with changed content (not R100) is still a hand write', flagged(viaMoveStaged, 'legacy/a.mjs'));

  process.env.CLAUDE_KIT_TURN_STATE = state;
  const { restoredSources } = await import('./lib/restored-content.mjs');
  const { gitRoot } = await import('./lib.mjs');
  const MINUTE_MS = 60 * 1000;
  const WINDOW_PLUS_MS = 31 * MINUTE_MS;
  const popped = fresh();
  edit(popped, 'S1', 'src/a.mjs', EDITED);
  git(['stash', 'push', '--', 'src'], popped);
  git(['stash', 'pop'], popped);
  const root = gitRoot(popped);
  const restores = (options, command = 'git stash pop') => restoredSources(root, ['src/a.mjs'], command, options).has('src/a.mjs');
  ok('keying control: the own session\'s confirmed entry with the blob in git\'s store is a restore', restores({ session: 'S1' }));
  ok('KIT-T982 control: an entry older than the window is no restore', !restores({ session: 'S1', now: Date.now() + WINDOW_PLUS_MS }));
  ok('KIT-T982 control: another session\'s entry is no restore', !restores({ session: 'S2' }));
  ok('KIT-T982 control: a call with no session identity is no restore', !restores({}));
  ok('KIT-T982 control: no git segment in the command, no replay', !restores({ session: 'S1' }, './run-tests.exe'));

  const { addHandWrites } = await import('./lib/hand-writes.mjs');
  const ledgeredMove = (extra) => {
    const d = fresh();
    mkdirSync(join(d, 'legacy'));
    git(['mv', 'src/a.mjs', 'legacy/a.mjs'], d);
    if (extra) writeFileSync(join(d, 'legacy', 'a.mjs'), extra);
    addHandWrites(gitRoot(d), 'S7', ['legacy/a.mjs']);
    return commit(d, 'S7', ['legacy/a.mjs']);
  };
  const { identicalRenameTargets } = await import('./lib/identical-renames.mjs');
  const SAME = 'a'.repeat(40);
  const OTHER = 'b'.repeat(40);
  const raw = (...entries) => `${entries.join('\0')}\0`;
  const rename = (oldMode, newMode, oldId, newId, status, from, to) => `:${oldMode} ${newMode} ${oldId} ${newId} ${status}\0${from}\0${to}`;
  const targets = (...entries) => [...identicalRenameTargets(raw(...entries))];
  ok('KIT-T991: a raw R100 rename with equal blob ids and modes is accepted', targets(rename('100644', '100644', SAME, SAME, 'R100', 'a', 'b')).join() === 'b');
  ok('KIT-T991 control: an R100 rename whose blob ids differ is refused', targets(rename('100644', '100644', SAME, OTHER, 'R100', 'a', 'b')).length === 0);
  ok('KIT-T991 control: an R100 rename that changes the file mode is refused', targets(rename('100644', '100755', SAME, SAME, 'R100', 'a', 'b')).length === 0);
  ok('KIT-T991 control: a scored rename below 100 is refused', targets(rename('100644', '100644', SAME, SAME, 'R095', 'a', 'b')).length === 0);
  ok('KIT-T991: entries around a rename (M, A, a copy) keep the parse aligned', targets(
    `:100644 100644 ${SAME} ${OTHER} M\0m.mjs`, rename('100644', '100644', SAME, OTHER, 'C080', 'c', 'd'), `:000000 100644 ${'0'.repeat(40)} ${SAME} A\0n.mjs`,
    rename('100644', '100644', SAME, SAME, 'R100', 'x', 'y'),
  ).join() === 'y');
  ok('KIT-T991: a ledgered path that is a byte-identical R100 rename commits', !ledgeredMove().out.includes('KIT-T706'));
  ok('KIT-T991 control: a ledgered rename whose content changed is still refused', ledgeredMove('export const a = 1;\nexport const z = 3;\n').out.includes('KIT-T706'));

  const predicted = fresh();
  const input = { session_id: 'S1', tool_input: { file_path: join(predicted, 'src', 'a.mjs'), content: EDITED } };
  spawnHook('pre-write.mjs', input, predicted);
  writeFileSync(join(predicted, 'src', 'a.mjs'), EDITED);
  git(['stash', 'push', '--', 'src'], predicted);
  git(['stash', 'pop'], predicted);
  ok('KIT-T982 control: an unconfirmed pre-write prediction is no restore', !restoredSources(gitRoot(predicted), ['src/a.mjs'], 'git stash pop', { session: 'S1' }).has('src/a.mjs'));

  const headFile = fresh();
  const headRoot = gitRoot(headFile);
  ok('a file equal to HEAD is restored with no session and no git in the command', restoredSources(headRoot, ['src/a.mjs'], './run-tests.exe').has('src/a.mjs'));
  writeFileSync(join(headFile, 'src', 'a.mjs'), 'export const a = 1; \n');
  ok('KIT-T982 control: one byte off HEAD is not a restore', !restoredSources(headRoot, ['src/a.mjs'], 'git status').has('src/a.mjs'));
  const noRepo = tmpDir('hw-norepo-');
  mkdirSync(join(noRepo, 'src'));
  writeFileSync(join(noRepo, 'src', 'a.mjs'), 'export const a = 1;\n');
  ok('KIT-T982 control: when git cannot answer nothing is restored (fail closed)', restoredSources(noRepo, ['src/a.mjs'], 'git status', { session: 'S1' }).size === 0);
} finally {
  cleanup();
}

done();
