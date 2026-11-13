// no-remote.test.mjs — a repo with `remote: none` lands as a local commit (KIT-T1122): nothing is fetched or
// pushed, a submodule lane with a remote still pushes, and the pin lands in the remote-less root as a local commit.
// The control is the same fixture with the default `origin` and no remote configured: the landing fails.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBroker } from './config.mjs';
import { NO_REMOTE, hasRemote, noRemoteRefusal } from './no-remote.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';

const SUPER = { name: 'super', path: '.', main: 'main' };
const SUB = { name: 'rapid-game', path: 'rapid-game', main: 'main', remote: 'origin', submodule: true, pin_in: '.' };

// The subkit fixture with its root's origin removed: the road demo's shape.
function remoteless(root = NO_REMOTE) {
  const t = setup({ repos: [{ ...SUPER, remote: root }, SUB] });
  g(['remote', 'remove', 'origin'], t.root);
  return t;
}

const FRAMEWORK = { repo: 'rapid-game', ticket: 'RDG-T1', title: 'framework half', land: true, 'no-pin': true };

test('a landing in a repo with remote: none is a local commit and nothing is pushed', () => {
  const t = remoteless();
  try {
    const before = g(['rev-parse', 'HEAD'], t.root);
    const { r } = t.run({ ticket: 'RDG-T1', title: 'demo edit', land: true }, '*** write demo.txt\nthe demo\n');
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(g(['rev-parse', 'HEAD'], t.root), r.landed.sha);
    assert.notEqual(r.landed.sha, before);
    assert.equal(g(['remote'], t.root), '', 'the fixture has no remote at all');
    assert.equal(g(['--git-dir', t.superBare, 'rev-parse', 'main'], t.root), before, 'the old bare origin never saw the commit');
    assert.match(g(['log', '-1', '--format=%s'], t.root), /demo edit \(implements RDG-T1\)/);
  } finally { t.done(); }
});

test('control: the same landing with the default origin and no remote configured fails and leaves no commit', () => {
  const t = remoteless('origin');
  try {
    const before = g(['rev-parse', 'HEAD'], t.root);
    const { r } = t.run({ ticket: 'RDG-T1', title: 'demo edit', land: true }, '*** write demo.txt\nthe demo\n');
    assert.notEqual(r.status, 'landed', JSON.stringify(r));
    assert.equal(g(['rev-parse', 'HEAD'], t.root), before, 'a landing that did not push leaves no commit');
  } finally { t.done(); }
});

test('a submodule landing pushes to its own remote and its pin lands in the remote-less root as a local commit', () => {
  const t = remoteless();
  try {
    const { r } = t.run({ repo: 'rapid-game', ticket: 'RDG-T2', title: 'framework half', land: true }, '*** write api.txt\nnew api\n');
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root), r.landed.sha, 'the framework commit reached its origin');
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], t.root), r.landed.sha, 'the root records it');
    assert.equal(g(['rev-parse', 'HEAD'], t.root), r.landed.superSha);
    assert.match(g(['log', '-1', '--format=%s'], t.root), /pin rapid-game/);
  } finally { t.done(); }
});

test('a root --pin job after a lane landing pins the framework sha into the remote-less root', () => {
  const t = remoteless();
  try {
    const fw = t.run(FRAMEWORK, '*** write api.txt\nnew api\n').r.landed.sha;
    assert.equal(g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root), fw);
    const { r } = t.run({ ticket: 'RDG-T2', title: 'demo half', land: true, pin: `rapid-game=${fw}` }, '*** write demo.txt\nuses the api\n');
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], t.root), fw);
    assert.equal(g(['rev-parse', 'HEAD'], t.root), r.landed.sha);
    assert.equal(g(['remote'], t.root), '');
  } finally { t.done(); }
});

test('a pin of a framework sha its own remote lacks is still refused in a remote-less root', () => {
  const t = remoteless();
  try {
    g(['-C', 'rapid-game', 'commit', '-q', '--allow-empty', '-m', 'local only'], t.root);
    const local = g(['rev-parse', 'HEAD'], t.sub);
    const before = g(['rev-parse', 'HEAD'], t.root);
    const { out } = t.run({ ticket: 'RDG-T3', title: 'demo', land: true, pin: `rapid-game=${local}` }, '*** write demo.txt\nd\n');
    assert.match(out.error, /not on origin\/main/);
    assert.equal(g(['rev-parse', 'HEAD'], t.root), before);
  } finally { t.done(); }
});

test('config: remote: none is read as given, an absent remote stays origin, and a pushing repo kind is refused', () => {
  const read = (repos) => normalizeBroker('.', { repos }).repos;
  assert.equal(read([{ ...SUPER, remote: 'none' }])[0].remote, NO_REMOTE);
  assert.equal(read([SUPER])[0].remote, 'origin');
  assert.equal(read([{ ...SUPER, remote: null }])[0].remote, 'origin');
  assert.throws(() => read([{ ...SUB, remote: 'none' }]), /cannot be a submodule lane/);
  assert.throws(() => read([{ ...SUPER, remote: 'none', pre_push: true }]), /pre_push: true needs a remote/);
  assert.equal(hasRemote('origin'), true);
  assert.equal(hasRemote('none'), false);
  assert.equal(hasRemote(''), false);
  assert.equal(noRemoteRefusal({ name: 'x', remote: 'origin', submodule: true, prePush: true }), null);
});
