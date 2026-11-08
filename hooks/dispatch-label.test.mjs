// dispatch-label.test.mjs — KIT-T337, KIT-T897: ONE label form on every dispatch path, required on the call and
// never written into it. Each path (explicit model, kit-agent pin, project pin, inherited session model, either tool
// name, background, adopted/unadopted/no repo, hand-written prefixes, the real hook launcher) must be told to
// resend `[<Family N[.M]>] <description>`, and a call already in that form passes untouched.
// Run: node hooks/dispatch-label.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENV, HOOKS, ROOT, adopted, cleanup, hook, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('dispatch-label');

const dispatch = (input, extra = {}, toolName = 'Task') => ({
  hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: input, ...extra,
});

const RESEND = /resend description as ("(?:[^"\\]|\\.)*")/;

// The description the block tells the caller to resend, or null when the call passes.
function label(payload, cwd) {
  const res = hook('dispatch-label.mjs', payload, cwd);
  if (res.code === 0) return null;
  const m = RESEND.exec(res.out);
  return m ? JSON.parse(m[1]) : `blocked without a description: ${res.out}`;
}

function transcript(dir, models) {
  const p = join(dir, 'transcript.jsonl');
  const rows = models.map((model) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', model } }));
  writeFileSync(p, `${rows.join('\n')}\n`);
  return p;
}

function projectAgent(dir, name, fm) {
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', `${name}.md`), `---\nname: ${name}\n${fm}\n---\nbody\n`);
}

try {
  const d = adopted(false);

  ok('explicit alias: sonnet', label(dispatch({ description: 'Fix it', model: 'sonnet' }), d) === '[Sonnet 5.5] Fix it');
  ok('explicit alias: opus', label(dispatch({ description: 'Fix it', model: 'opus' }), d) === '[Opus 5.5] Fix it');
  ok('explicit full id: opus 5.5', label(dispatch({ description: 'Fix it', model: 'claude-opus-5-5' }), d) === '[Opus 5.5] Fix it');
  ok('explicit full id: sonnet 5.5', label(dispatch({ description: 'Fix it', model: 'claude-sonnet-5-5' }), d) === '[Sonnet 5.5] Fix it');
  ok('explicit full id: fable 5', label(dispatch({ description: 'Fix it', model: 'claude-fable-5' }), d) === '[Fable 5] Fix it');

  ok('kit agent on a family: claude-kit:patch-worker + sonnet', label(dispatch({ description: 'Land it', subagent_type: 'claude-kit:patch-worker', model: 'sonnet' }), d) === '[Sonnet 5.5] Land it');
  ok('kit agent on a family: claude-kit:refactorer + opus', label(dispatch({ description: 'Build it', subagent_type: 'claude-kit:refactorer', model: 'opus' }), d) === '[Opus 5.5] Build it');
  ok('a call with no model, no job and no transcript passes: nothing to guess', label(dispatch({ description: 'Build it', subagent_type: 'unjobbed-agent' }), d) === null);
  ok('a kit agent default job with no model is told the table family and the matching label', label(dispatch({ description: 'Build it', subagent_type: 'claude-kit:refactorer' }), d) === '[Sonnet 5.5] Build it');
  ok('local-qwen is a known family: a hand-written tag is replaced', label(dispatch({ description: '[local-qwen] Build it', model: 'haiku' }), d) === '[Haiku 5.5] Build it');

  projectAgent(d, 'proj-pinned', 'model: claude-opus-5-5');
  projectAgent(d, 'proj-inherit', 'model: inherit');
  const tp = transcript(d, ['claude-fable-5', '<synthetic>']);
  ok('project agent pin', label(dispatch({ description: 'Do it', subagent_type: 'proj-pinned' }), d) === '[Opus 5.5] Do it');
  ok('`model: inherit` resolves to the session model, skipping a synthetic turn',
    label(dispatch({ description: 'Do it', subagent_type: 'proj-inherit' }, { transcript_path: tp }), d) === '[Fable 5] Do it');
  ok('no model, no pin: the session model', label(dispatch({ description: 'Do it', subagent_type: 'general-purpose' }, { transcript_path: tp }), d) === '[Fable 5] Do it');

  const bg = dispatch({ description: 'Do it', model: 'sonnet', run_in_background: true, prompt: 'brief' }, {}, 'Agent');
  ok('tool name Agent and Task give the same label', label(bg, d) === '[Sonnet 5.5] Do it');
  const launched = spawnSync(process.execPath, [join(HOOKS, 'dispatch-label.mjs')], { input: JSON.stringify(bg), cwd: d, encoding: 'utf8', env: ENV });
  ok('a block writes nothing to stdout: no updatedInput, no permissionDecision', launched.status === 2 && launched.stdout === '');

  ok('unadopted repo is held to the form', label(dispatch({ description: 'Do it', model: 'sonnet' }), repo()) === '[Sonnet 5.5] Do it');
  ok('a directory with no repo at all is held to the form', label(dispatch({ description: 'Do it', model: 'sonnet' }), tmpDir('kit-norepo-')) === '[Sonnet 5.5] Do it');

  for (const [typed, want] of [
    ['[opus] Do it', '[Sonnet 5.5] Do it'],
    ['[sonnet] Do it', '[Sonnet 5.5] Do it'],
    ['[claude-opus-5-5] Do it', '[Sonnet 5.5] Do it'],
    ['[sonnet55] Do it', '[Sonnet 5.5] Do it'],
    ['[Opus 5] Do it', '[Sonnet 5.5] Do it'],
    ['[Sonnet 5.5] Do it', null],
    ['[KIT-T337] Do it', '[Sonnet 5.5] [KIT-T337] Do it'],
  ]) {
    ok(`hand-written ${typed.split(']')[0]}] -> ${want === null ? 'passes untouched' : 'the one form'}`, label(dispatch({ description: typed, model: 'sonnet' }), d) === want);
  }
  const once = label(dispatch({ description: 'Do it', model: 'sonnet' }), d);
  ok('resending the named form passes', label(dispatch({ description: once, model: 'sonnet' }), d) === null);

  ok('indeterminate model: no guess, the caller label stands', label(dispatch({ description: '[opus] Do it', subagent_type: 'general-purpose' }), d) === null);
  ok('a dispatch with no description passes', label(dispatch({ model: 'opus', prompt: 'no description here' }), d) === null);
  ok('a blank description passes', label(dispatch({ description: '   ', model: 'opus' }), d) === null);

  const bothWrong = hook('dispatch-label.mjs', dispatch({ description: '[opus] Fix it', prompt: 'x [job: fix]' }), d);
  ok('a job with no model and a wrong tag: one block lists the model AND the description', bothWrong.code === 2
    && bothWrong.out.includes("- model: pass model:'sonnet'") && bothWrong.out.includes('- description: resend description as "[Sonnet 5.5] Fix it"'));
  ok('an explicit model is never replaced by the table', label(dispatch({ description: 'Fix it', model: 'opus', prompt: 'x [job: fix]' }), d) === '[Opus 5.5] Fix it');
  ok('the block points at q gates agent', bothWrong.out.includes('q gates agent'));

  const through = spawnSync(process.execPath, [join(HOOKS, 'compat-run.mjs'), 'dispatch-label.mjs'], {
    input: JSON.stringify(dispatch({ description: 'Do it', model: 'claude-opus-5-5' })),
    cwd: d, encoding: 'utf8', env: { ...ENV, CLAUDE_PLUGIN_ROOT: ROOT, PLUGIN_ROOT: '' },
  });
  ok('through compat-run (the installed command path) the block names the form', through.status === 2 && /\[Opus 5\.5\] Do it/.test(through.stderr || ''));
  ok('fails open on malformed stdin', hook('dispatch-label.mjs', null, d, '{not json at all').code === 0);
  ok('fails open on a wrong-shaped tool_input', hook('dispatch-label.mjs', { hook_event_name: 'PreToolUse', tool_input: 'not an object' }, d).code === 0);
} finally {
  cleanup();
}
done();
