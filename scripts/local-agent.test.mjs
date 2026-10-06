// local-agent.test.mjs — KIT-D080: the local Qwen lane's argument and prompt assembly, patch
// extraction, broker mode detection and concurrency slots. No server is needed; the CLI is
// exercised through --dry-run. Run: node scripts/local-agent.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reporter, tmpDir, cleanup } from '../hooks/test-harness.mjs';
import { LOCAL_MODEL, PATCH_BEGIN, PATCH_END, modeFor, buildPrompt, buildInvocation, extractPatch, submitArgs, acquireSlot } from './local-agent-lib.mjs';

const { ok, done } = reporter('local-agent');
const CLI = fileURLToPath(new URL('./local-agent.mjs', import.meta.url));

const brokerTree = () => {
  const dir = tmpDir('la-broker-');
  mkdirSync(join(dir, 'target', 'broker'), { recursive: true });
  writeFileSync(join(dir, 'target', 'broker', 'broker.lock'), JSON.stringify({ pid: process.pid, host: hostname() }));
  return dir;
};

try {
  const direct = buildInvocation({ repo: 'D:/r', mode: 'direct', outFile: 'o.txt', rigDir: 'D:\\llm' });
  const broker = buildInvocation({ repo: 'D:/r', mode: 'broker', outFile: 'o.txt', rigDir: 'D:\\llm' });
  ok('invocation: goes through the rig codex launcher', /codex-local\.cmd$/.test(direct.command));
  ok('invocation: exec, the 3-slot model, the repo, the output file, prompt on stdin',
    direct.args[0] === 'exec' && direct.args.includes(LOCAL_MODEL) && direct.args[direct.args.indexOf('--cd') + 1] === 'D:/r'
      && direct.args[direct.args.indexOf('--output-last-message') + 1] === 'o.txt' && direct.args.at(-1) === '-');
  ok('invocation: a direct tree is workspace-write, a broker tree is read-only',
    direct.args[direct.args.indexOf('--sandbox') + 1] === 'workspace-write' && broker.args[broker.args.indexOf('--sandbox') + 1] === 'read-only');
  ok('invocation: an explicit model wins', buildInvocation({ repo: 'r', mode: 'direct', outFile: 'o', model: 'qwen3.8-27b' }).args.includes('qwen3.8-27b'));

  const bp = buildPrompt({ brief: 'Change X in a.rs L10-20', mode: 'broker', ticket: 'KIT-T1' });
  const dp = buildPrompt({ brief: 'Change X in a.rs L10-20', mode: 'direct' });
  ok('prompt: the brief leads and the ticket is named', bp.startsWith('# Brief\nChange X in a.rs L10-20') && bp.includes('Ticket: KIT-T1'));
  ok('prompt: broker mode demands a patch envelope and forbids writing', bp.includes(PATCH_BEGIN) && bp.includes('NEVER write it') && !dp.includes(PATCH_BEGIN));
  ok('prompt: direct mode forbids git writes', dp.includes('Never run git commit'));

  const reply = `done.\n${PATCH_BEGIN}\n*** edit a.rs\n<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE\n${PATCH_END}\ntrailing`;
  ok('patch: extracted between the markers', extractPatch(reply) === '*** edit a.rs\n<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE\n');
  ok('patch: a missing end marker takes the rest', extractPatch(`x\n${PATCH_BEGIN}\n*** delete b.rs`) === '*** delete b.rs\n');
  ok('patch: no marker -> empty', extractPatch('I changed it, trust me') === '');

  const args = submitArgs({ kitRoot: 'K', root: 'T', ticket: 'KIT-T1', title: 'x', tests: ['a', 'b'], land: true, revises: 'p1' });
  ok('submit: root, ticket, title, repeatable test, land, revises',
    args.join(' ') === `${join('K', 'scripts', 'broker', 'submit.mjs')} --root T --ticket KIT-T1 --title x --test a --test b --land --revises p1`);
  ok('submit: a check-only patch carries no --land', !submitArgs({ kitRoot: 'K', root: 'T', title: 'x' }).includes('--land'));

  ok('mode: a live broker lock means broker', modeFor(brokerTree()) === 'broker');
  ok('mode: no lock means direct', modeFor(tmpDir('la-plain-')) === 'direct');
  const dead = tmpDir('la-dead-');
  mkdirSync(join(dead, 'target', 'broker'), { recursive: true });
  writeFileSync(join(dead, 'target', 'broker', 'broker.lock'), JSON.stringify({ pid: 2147483646, host: hostname() }));
  ok('mode: a dead pid in the lock means direct', modeFor(dead) === 'direct');

  const slots = tmpDir('la-slots-');
  const a = acquireSlot({ dir: slots, repo: 'R1', mode: 'broker' });
  const b = acquireSlot({ dir: slots, repo: 'R1', mode: 'broker' });
  const c = acquireSlot({ dir: slots, repo: 'R1', mode: 'broker' });
  ok('slots: three broker agents share one tree on distinct slots', a && b && c && new Set([a.index, b.index, c.index]).size === 3);
  ok('slots: a fourth is refused', acquireSlot({ dir: slots, repo: 'R1', mode: 'broker' }) === null);
  b.release();
  const again = acquireSlot({ dir: slots, repo: 'R2', mode: 'direct' });
  ok('slots: a released slot is reusable', again && again.index === b.index);
  ok('slots: a second direct writer in the same repo is refused (one writer per checkout)', (() => {
    const s2 = tmpDir('la-slots2-');
    const first = acquireSlot({ dir: s2, repo: 'R', mode: 'direct' });
    const clash = acquireSlot({ dir: s2, repo: 'R', mode: 'direct' });
    const other = acquireSlot({ dir: s2, repo: 'OTHER', mode: 'direct' });
    return first && clash === null && other !== null;
  })());
  ok('slots: a stale slot file from a dead pid is reclaimed', (() => {
    const s3 = tmpDir('la-slots3-');
    writeFileSync(join(s3, 'slot-0.json'), JSON.stringify({ pid: 2147483646, repo: 'R', mode: 'direct' }));
    const got = acquireSlot({ dir: s3, repo: 'R', mode: 'direct' });
    return got && got.index === 0;
  })());

  const brief = join(tmpDir('la-brief-'), 'brief.md');
  writeFileSync(brief, 'Rename foo to bar in x.rs lines 1-9. Acceptance: grep foo x.rs is empty.');
  const dry = spawnSync(process.execPath, [CLI, '--brief', brief, '--repo', brokerTree(), '--report', join(tmpDir('la-rep-'), 'r.md'), '--dry-run'], { encoding: 'utf8' });
  const plan = JSON.parse(dry.stdout || '{}');
  ok('cli: --dry-run assembles the broker-mode invocation without spawning anything',
    dry.status === 0 && plan.mode === 'broker' && plan.model === LOCAL_MODEL && plan.args.includes('read-only') && plan.prompt.includes('Rename foo to bar'));
  const usage = spawnSync(process.execPath, [CLI, '--brief', brief], { encoding: 'utf8' });
  ok('cli: missing --repo/--report is a usage error (exit 2)', usage.status === 2);
} finally {
  cleanup();
}
done();
