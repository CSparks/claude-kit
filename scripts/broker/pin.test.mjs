// pin.test.mjs — landing a superproject patch and its submodule pin as ONE commit (KIT-T320):
// `--no-pin` pushes the submodule commit and leaves the superproject alone; `--pin name=sha` builds
// and tests with the submodule at <sha> and a landing commits the gitlink with the patch paths; a
// landing refuses a sha the submodule's origin does not have.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, g } from './patchkit.mjs';
import { addOrigin, cleanup, makeRepo, tempDir } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const SUB_HEAD = 'git -C rapid-game rev-parse HEAD';

function setup() {
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
    verify_default: [PASS],
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
const names = (cwd) => g(['show', '--name-only', '--pretty=format:', 'HEAD'], cwd).split('\n').map((l) => l.trim()).filter(Boolean).sort();

test('--no-pin pushes the submodule commit and leaves the superproject untouched', () => {
  const t = setup();
  try {
    const superHead = g(['rev-parse', 'HEAD'], t.root);
    const { r } = t.run({ repo: 'rapid-game', ticket: 'ST-T1', title: 'framework half', land: true, 'no-pin': true }, '*** write api.txt\nnew api\n');
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(r.landed.superSha, null);
    assert.equal(g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root), r.landed.sha, 'submodule pushed');
    assert.equal(g(['rev-parse', 'HEAD'], t.root), superHead, 'no superproject commit');
    assert.equal(g(['--git-dir', t.superBare, 'rev-parse', 'main'], t.root), superHead);
  } finally { t.done(); }
});

test('--pin lands the gitlink and the patch paths in ONE commit, tested with the submodule at that sha', () => {
  const t = setup();
  try {
    const fw = t.run({ repo: 'rapid-game', ticket: 'ST-T1', title: 'framework half', land: true, 'no-pin': true }, '*** write api.txt\nnew api\n').r.landed.sha;
    g(['checkout', '-q', '--detach', 'HEAD~1'], t.sub); // the working submodule is elsewhere when the game job starts
    const before = g(['rev-parse', 'HEAD'], t.sub);
    const { r } = t.run({ ticket: 'ST-T1', title: 'game half', land: true, pin: `rapid-game=${fw}` }, '*** write game.txt\nuses the api\n', [SUB_HEAD]);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.match(r.commands[0].logTail.join('\n'), new RegExp(fw), 'tests ran with the submodule at the pinned sha');
    assert.deepEqual(names(t.root), ['game.txt', 'rapid-game'], 'one commit: the patch path and the gitlink');
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], t.root), fw);
    assert.equal(g(['rev-list', '--count', 'HEAD'], t.root), '3', 'init, add submodule, ONE landing commit');
    assert.equal(g(['--git-dir', t.superBare, 'rev-parse', 'main'], t.root), r.landed.sha, 'superproject pushed');
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), fw, 'the submodule is left at the pinned sha');
    assert.equal(g(['symbolic-ref', '--short', 'HEAD'], t.sub), 'main', 'and back on its branch');
    assert.notEqual(before, fw);
  } finally { t.done(); }
});

test('--pin with a sha the submodule origin lacks is refused for a landing, at submit and again at run time', () => {
  const t = setup();
  try {
    commitOnMain(t.sub, 'local.txt', 'unpushed\n', 'local only');
    const local = g(['rev-parse', 'HEAD'], t.sub);
    const refused = buildPatchJob(t.cfg, { ticket: 'ST-T1', title: 'x', land: true, pin: `rapid-game=${local}` }, '*** write game.txt\ng\n');
    assert.match(refused.error, /not on origin\/main/);

    const check = buildPatchJob(t.cfg, { pin: `rapid-game=${local}` }, '*** write game.txt\ng\n');
    assert.ok(check.job, 'a check-only job may pin an unpushed sha');
    writeJob(t.cfg, { ...check.job, land: true, ticket: 'ST-T1', commands: [PASS] });
    processOnce(t.cfg);
    const r = readResult(t.cfg, check.job.id);
    assert.equal(r.status, 'failed');
    assert.equal(r.phase, 'pin');
    assert.match(r.message, /unpushed sha/);
  } finally { t.done(); }
});

test('negative: a check-only --pin job restores the submodule checkout and commits nothing', () => {
  const t = setup();
  try {
    const fw = t.run({ repo: 'rapid-game', ticket: 'ST-T1', title: 'framework half', land: true, 'no-pin': true }, '*** write api.txt\nnew api\n').r.landed.sha;
    g(['checkout', '-q', '--detach', 'HEAD~1'], t.sub);
    const prev = g(['rev-parse', 'HEAD'], t.sub);
    const head = g(['rev-parse', 'HEAD'], t.root);
    const { r } = t.run({ pin: `rapid-game=${fw}` }, '*** write game.txt\nuses the api\n', [SUB_HEAD]);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.match(r.commands[0].logTail.join('\n'), new RegExp(fw));
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), prev, 'submodule back where it was');
    assert.equal(g(['rev-parse', 'HEAD'], t.root), head);
    assert.equal(g(['status', '--porcelain', '--untracked-files=no'], t.root), '');
  } finally { t.done(); }
});

test('flag misuse is refused: --no-pin on a non-submodule repo, --pin on a submodule job, an unknown submodule', () => {
  const t = setup();
  try {
    assert.match(buildPatchJob(t.cfg, { 'no-pin': true }, '*** write a.txt\na\n').error, /submodule/);
    assert.match(buildPatchJob(t.cfg, { repo: 'rapid-game', pin: 'rapid-game=abcdef1' }, '*** write a.txt\na\n').error, /superproject job/);
    assert.match(buildPatchJob(t.cfg, { pin: 'nope=abcdef1' }, '*** write a.txt\na\n').error, /not a submodule/);
  } finally { t.done(); }
});

// A framework commit landed with --no-pin: the live submodule now sits ahead of the recorded pin.
function aheadOfPin(t) {
  const pinned = g(['rev-parse', 'HEAD:rapid-game'], t.root);
  const ahead = t.run({ repo: 'rapid-game', ticket: 'ST-T1', title: 'framework half', land: true, 'no-pin': true }, '*** write api.txt\nnew api\n').r.landed.sha;
  assert.notEqual(pinned, ahead);
  return { pinned, ahead };
}

test('a job without --pin builds with the submodule at the sha HEAD records, then restores the checkout', () => {
  const t = setup();
  try {
    const { pinned, ahead } = aheadOfPin(t);
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), ahead);
    const { r } = t.run({ ticket: 'ST-T9', title: 'unrelated', land: true }, '*** write other.txt\nunrelated\n', [SUB_HEAD]);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.match(r.commands[0].logTail.join('\n'), new RegExp(pinned), 'built at the recorded pin');
    assert.doesNotMatch(r.commands[0].logTail.join('\n'), new RegExp(ahead));
    assert.deepEqual(names(t.root), ['other.txt'], 'the landing does not move the gitlink');
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), ahead, 'the submodule is back at its own checkout');
    assert.equal(g(['symbolic-ref', '--short', 'HEAD'], t.sub), 'main');
  } finally { t.done(); }
});

test('a check-only job without --pin also builds at the pin and restores', () => {
  const t = setup();
  try {
    const { pinned, ahead } = aheadOfPin(t);
    const { r } = t.run({}, '*** write other.txt\nunrelated\n', [SUB_HEAD]);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.match(r.commands[0].logTail.join('\n'), new RegExp(pinned));
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), ahead);
  } finally { t.done(); }
});

test('a --pin job still uses its own sha, and no pin is applied when the submodule already sits at the record', () => {
  const t = setup();
  try {
    const { pinned, ahead } = aheadOfPin(t);
    const { r } = t.run({ pin: `rapid-game=${ahead}` }, '*** write other.txt\nx\n', [SUB_HEAD]);
    assert.match(r.commands[0].logTail.join('\n'), new RegExp(ahead));
    g(['checkout', '-q', '--detach', pinned], t.sub);
    const again = t.run({}, '*** write other2.txt\nx\n', [SUB_HEAD]).r;
    assert.equal(again.status, 'passed');
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), pinned);
  } finally { t.done(); }
});

test('negative: uncommitted work inside a submodule that must move refuses the job and is left alone', () => {
  const t = setup();
  try {
    aheadOfPin(t);
    writeFileSync(join(t.sub, 'api.txt'), 'hand edit\n');
    const { r } = t.run({}, '*** write other.txt\nx\n', [SUB_HEAD]);
    assert.equal(r.status, 'failed');
    assert.equal(r.phase, 'pin');
    assert.match(r.message, /uncommitted changes/);
    assert.equal(readFileSync(join(t.sub, 'api.txt'), 'utf8'), 'hand edit\n');
  } finally { t.done(); }
});
