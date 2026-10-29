// wait-poll (KIT-T355): re-reading a background-task output file more than twice and sleep/check
// loops around a build file warn twice, then block on the third offence of a session. One read of a
// completed output passes. The rule text in docs/wait-rule.md rides in every agent definition.
// Run: node hooks/wait-poll.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

import { ENV, HOOKS, ROOT, adopted, cleanup, hook, reporter, repo, tmpDir } from './test-harness.mjs';
import { hiddenBehindQuotes } from './hidden-command-cases.mjs';

const { ok, done } = reporter('wait-poll');
const OUT = "C:/Users/x/AppData/Local/Temp/claude/proj/sess/tasks/bk1.output";
const BACKSLASHED = OUT.replaceAll('/', String.fromCharCode(92));

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const entry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('wait-poll')));
  ok('wired into hooks.json for Read, Bash and PowerShell', !!entry && ['Read', 'Bash', 'PowerShell'].every((t) => entry.matcher.includes(t)));

  const state = tmpDir('wp-state-');
  const mk = (tool, input, sid) => ({ tool_name: tool, session_id: sid, tool_input: input });
  const run = (d, payload) => hook('wait-poll.mjs', payload, d, { CLAUDE_KIT_TURN_STATE: state });
  const read = (d, sid, f = OUT) => run(d, mk('Read', { file_path: f }, sid));
  const bash = (d, sid, command) => run(d, mk('Bash', { command }, sid));

  const d = adopted(false);
  ok('one Read of a completed task output passes silently', (() => { const r = read(d, 'neg1'); return r.code === 0 && r.out === ''; })());
  ok('a second Read still passes silently', (() => { const r = read(d, 'neg1'); return r.code === 0 && r.out === ''; })());
  ok('reading many DIFFERENT output files passes', ['a', 'b', 'c', 'd'].every((n) => read(d, 'neg2', OUT.replace('bk1', n)).code === 0));
  ok('reading an ordinary file many times passes', [1, 2, 3, 4].every(() => read(d, 'neg3', join(d, 'foo.ts')).code === 0));
  ok('backslash and forward-slash spellings count as the same file', [1,2,3].map((i) => read(adopted(false), 'bs', i % 2 ? OUT : BACKSLASHED).code).every((c) => c === 0) && (() => { const d2 = adopted(false); read(d2, 'bs2', OUT); read(d2, 'bs2', BACKSLASHED); return /offence 1/.test(read(d2, 'bs2', OUT).out); })());
  ok('one cat of a task output passes', bash(d, 'neg4', `cat "${OUT}"`).code === 0);
  ok('a bare sleep with no build-file check passes', bash(d, 'neg5', 'sleep 2 && echo done').code === 0);
  ok('a filtered one-call test run passes', bash(d, 'neg6', 'cargo t -p x 2>&1 | grep -E "^test result|FAILED|panicked"').code === 0);

  const third = read(d, 'neg1');
  ok('3rd Read of the same output file warns (offence 1)', third.code === 0 && /WARNING \(offence 1/.test(third.out) && third.out.includes('docs/wait-rule.md'));
  ok('4th warns (offence 2)', /offence 2/.test(read(d, 'neg1').out) && read(d, 'neg1').code === 2);

  ok('KIT-T705 negative control: node -e with escaped quotes and no task output passes', bash(adopted(false), 'neg-esc', 'node -e "console.log(\\"x\\")"').code === 0);
  const hiddenReads = hiddenBehindQuotes(`cat "${OUT}"`);
  const hid = adopted(false);
  const hiddenResults = [...hiddenReads, ...hiddenReads, hiddenReads[0]].map((c) => bash(hid, 'hid1', c));
  ok('KIT-T705: re-reads of one task output hidden behind an escaped quote or a $\'…\' string still count and block', hiddenResults.slice(0, 2).every((r) => r.code === 0) && hiddenResults[4].code === 2);

  const sid = 'pos1';
  const results = [1, 2, 3, 4, 5].map(() => read(d, sid));
  const blocked = results[4];
  ok('Read x2 free, 3rd and 4th warn, 5th (offence 3) blocks citing the rule', results.slice(0, 4).every((r) => r.code === 0) && blocked.code === 2
    && /BLOCKED \(offence 3\)/.test(blocked.out) && /max timeout|run_in_background/.test(blocked.out) && blocked.out.includes('wait-poll') && blocked.out.includes('.claude-kit-ignore.yaml'));

  const e = adopted(false);
  const cats = [1, 2, 3, 4, 5].map(() => bash(e, 'pos2', `tail -n 20 ${OUT}`));
  ok('repeated tail of one output file blocks on offence 3', cats.slice(0, 4).every((r) => r.code === 0) && cats[4].code === 2);

  const f = adopted(false);
  const loops = ['until grep -q "test result" /tmp/build.log; do sleep 5; done', 'while [ ! -s target/out.log ]; do sleep 3; done', 'sleep 60; tail -20 build.log'];
  const lr = loops.map((c) => bash(f, 'pos3', c));
  ok('sleep loops around a build/output file warn, warn, then block', lr[0].code === 0 && /offence 1/.test(lr[0].out) && lr[1].code === 0 && lr[2].code === 2);
  ok('PowerShell Start-Sleep loop is an offence', /offence 1/.test(bash(adopted(false), 'pos4', 'while (-not (Test-Path target\out.log)) { Start-Sleep 5 }').out));

  const g = adopted(false);
  writeFileSync(join(g, '.claude-kit-ignore.yaml'), 'wait-poll:\n  - "**/tasks/**"\n');
  ok('.claude-kit-ignore.yaml glob excludes an output file', [1, 2, 3, 4, 5].every(() => read(g, 'ex1', OUT).code === 0));
  ok('in-source marker excludes a sleep loop', bash(adopted(false), 'ex2', 'sleep 5; tail build.log  # claude-kit-ignore wait-poll').out === '');

  ok('unadopted repo is never touched', [1, 2, 3, 4, 5].every(() => read(repo(), 'un1').code === 0));
  const bad = spawnSync(process.execPath, [join(HOOKS, 'wait-poll.mjs')], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV });
  ok('malformed stdin fails open', bad.status === 0);

  const rule = readFileSync(join(ROOT, 'docs', 'wait-rule.md'), 'utf8');
  const agents = execFileSync('git', ['ls-files', 'agents'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((x) => x.endsWith('.md') && !x.endsWith('README.md'));
  ok('every agent definition carries docs/wait-rule.md verbatim', agents.length >= 10 && agents.every((a) => readFileSync(join(ROOT, a), 'utf8').includes(rule)));
  ok('work and drain briefs carry the wait rule', ['commands/work.md', 'commands/drain.md'].every((c) => readFileSync(join(ROOT, c), 'utf8').includes('docs/wait-rule.md')));
} finally {
  cleanup();
}

done();
