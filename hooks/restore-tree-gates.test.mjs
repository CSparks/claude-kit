// restore-tree and the shell gates (KIT-T1340): a call of the kit verb is git restoring committed content, so the hand-write check
// blames it for nothing and the PreToolUse gate lets it through; every other way to bring the same files back, or to delete a
// stray, stays judged as it was. A raw `git checkout <rev> -- <dir>` leaves strays a subagent may not rm; the block says which verb returns them.
// Run: node hooks/restore-tree-gates.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, git, reporter, ROOT } from './test-harness.mjs';
import { handWriteHarness } from './hand-write-harness.mjs';
import { restoreTreeCall } from './lib/restore-tree-call.mjs';
import { restoreTree } from '../scripts/restore-tree.mjs';

const { ok, done } = reporter('restore-tree-gates');

const NOT_GENERATOR = './run-tests.exe';
const KIT_SCRIPT = join(ROOT, 'scripts', 'restore-tree.mjs').replace(/\\/g, '/');
const quiet = { out: { write() {} }, err: { write() {} } };

try {
  const { call, fresh, spawnHook, scratch } = handWriteHarness();
  const flagged = (r, file) => r.status === 2 && r.stderr.includes(file);
  const clean = (r) => r.status === 0 && !r.stderr.includes('HAND WRITE');

  // seed: src/a.mjs (1), src/b.mjs (2). Head: a.mjs changed, b.mjs deleted, c.mjs added.
  const advanced = () => {
    const d = fresh();
    const seed = git(['rev-parse', 'HEAD'], d).trim();
    writeFileSync(join(d, 'src', 'a.mjs'), 'export const a = 5;\n');
    writeFileSync(join(d, 'src', 'c.mjs'), 'export const c = 3;\n');
    git(['rm', '-q', 'src/b.mjs'], d);
    git(['add', '-A'], d);
    git(['commit', '-q', '-m', 'later'], d);
    return { d, seed };
  };
  const verb = (d, args) => restoreTree(args, { ...quiet, cwd: d });

  const a = advanced();
  const forward = call(a.d, 'S1', `restore-tree ${a.seed} src && ${NOT_GENERATOR}`, () => verb(a.d, [a.seed, 'src']));
  ok('the verb writing an older revision (changed, restored and removed source) is no hand write', clean(forward), forward.stderr);
  const back = call(a.d, 'S1', 'restore-tree --back src', () => verb(a.d, ['--back', 'src']));
  ok('the verb returning to HEAD is no hand write', clean(back), back.stderr);

  const viaNode = advanced();
  const nodeRun = call(viaNode.d, 'S1', `node ${KIT_SCRIPT} ${viaNode.seed} src`, () => verb(viaNode.d, [viaNode.seed, 'src']));
  ok('node on the kit script is the verb too', clean(nodeRun), nodeRun.stderr);

  const withWrite = advanced();
  const mixed = call(withWrite.d, 'S1', `restore-tree ${withWrite.seed} src`, () => {
    verb(withWrite.d, [withWrite.seed, 'src']);
    writeFileSync(join(withWrite.d, 'src', 'z.mjs'), 'export const z = 99;\n');
  });
  ok('negative control: a source file written beside the verb is still a hand write', flagged(mixed, 'src/z.mjs') && !mixed.stderr.includes('src/b.mjs'));

  const impostor = advanced();
  const impostorRun = call(impostor.d, 'S1', `./restore-tree ${impostor.seed} src`, () => verb(impostor.d, [impostor.seed, 'src']));
  ok('negative control: a program at a path named restore-tree is no kit verb, its old content is flagged', flagged(impostorRun, 'src/b.mjs'));

  const scratchCopy = advanced();
  const scratchRun = call(scratchCopy.d, 'S1', `node ${join(scratch, 'restore-tree.mjs').replace(/\\/g, '/')} ${scratchCopy.seed} src`, () => verb(scratchCopy.d, [scratchCopy.seed, 'src']));
  ok('negative control: a scratch script named restore-tree.mjs is no kit verb', flagged(scratchRun, 'src/b.mjs'));

  const noVerb = advanced();
  const bareRun = call(noVerb.d, 'S1', NOT_GENERATOR, () => verb(noVerb.d, [noVerb.seed, 'src']));
  ok('negative control: the same restored files with no verb and no git in the command are flagged', flagged(bareRun, 'src/b.mjs'));

  ok('restoreTreeCall: the bare verb, its .mjs and .cmd spellings, behind an assignment', ['restore-tree x src', 'restore-tree.mjs x src', 'restore-tree.cmd --back src', 'X=1 restore-tree --back src'].every((c) => restoreTreeCall(c, a.d)));
  ok('restoreTreeCall: node on the kit script', restoreTreeCall(`node ${KIT_SCRIPT} --back src`, a.d));
  ok('restoreTreeCall: negative control: a path before the verb, a scratch script and other commands are not the verb',
    ['./restore-tree x src', `node ${join(scratch, 'restore-tree.mjs')} x src`, 'git restore-tree x src', 'rm restore-tree', 'echo restore-tree'].every((c) => !restoreTreeCall(c, a.d)));

  // The PreToolUse delete gate: the verb passes, a subagent's rm of a stray left by a raw checkout stays refused and names the verb.
  const gate = (d, command, agent = '') => spawnHook('source-shell-gate.mjs', { session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: 'Bash', tool_input: { command } }, d);
  const g = advanced();
  ok('the gate lets the verb through, forward and back', gate(g.d, `restore-tree ${g.seed} src`, 'A1').status === 0 && gate(g.d, 'restore-tree --back src', 'A1').status === 0);
  git(['checkout', g.seed, '--', 'src'], g.d);
  git(['reset', '-q'], g.d);
  const rm = gate(g.d, 'rm src/b.mjs', 'A1');
  ok('negative control: a subagent still may not rm the stray a raw checkout left', rm.status === 2 && /source-shell-write/.test(rm.stderr));
  ok('the refusal names restore-tree --back as the way out', /restore-tree --back/.test(rm.stderr));
  ok('negative control: a redirect onto the stray is still refused', gate(g.d, 'echo x > src/b.mjs', 'A1').status === 2);
  ok('and the verb then removes the stray', verb(g.d, ['--back', 'src']) === 0 && git(['status', '--porcelain', '--', 'src'], g.d).trim() === '');
} finally {
  cleanup();
}

done();
