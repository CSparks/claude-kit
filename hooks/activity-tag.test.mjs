// activity-tag.test.mjs — KIT-T337: ONE label form on every dispatch path.
// Each path (explicit model, kit-agent pin, project pin, inherited session model, either tool
// name, background, adopted/unadopted/no repo, hand-written prefixes, the real hook launcher)
// must come out `[<Family N[.M]>] <description>`.
// Run: node hooks/activity-tag.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENV, HOOKS, ROOT, adopted, cleanup, hook, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('activity-tag');

const dispatch = (input, extra = {}, toolName = 'Task') => ({
  hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: input, ...extra,
});

// The description the hook would hand the harness, or null when it says nothing.
function label(payload, cwd) {
  const out = hook('activity-tag.mjs', payload, cwd).out.trim();
  if (!out) return null;
  return JSON.parse(out).hookSpecificOutput.updatedInput.description;
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

  // explicit model on the call
  ok('explicit alias: sonnet', label(dispatch({ description: 'Fix it', model: 'sonnet' }), d) === '[Sonnet 5.5] Fix it');
  ok('explicit alias: opus', label(dispatch({ description: 'Fix it', model: 'opus' }), d) === '[Opus 5.5] Fix it');
  ok('explicit full id: opus 5.5', label(dispatch({ description: 'Fix it', model: 'claude-opus-5-5' }), d) === '[Opus 5.5] Fix it');
  ok('explicit full id: sonnet 5.5', label(dispatch({ description: 'Fix it', model: 'claude-sonnet-5-5' }), d) === '[Sonnet 5.5] Fix it');
  ok('explicit full id: fable 5', label(dispatch({ description: 'Fix it', model: 'claude-fable-5' }), d) === '[Fable 5] Fix it');

  // kit agents carry no model: the family on the call decides (KIT-D080)
  ok('kit agent on a family: claude-kit:patch-worker + sonnet', label(dispatch({ description: 'Land it', subagent_type: 'claude-kit:patch-worker', model: 'sonnet' }), d) === '[Sonnet 5.5] Land it');
  ok('kit agent on a family: claude-kit:refactorer + opus', label(dispatch({ description: 'Build it', subagent_type: 'claude-kit:refactorer', model: 'opus' }), d) === '[Opus 5.5] Build it');
  ok('a kit agent with no model and no transcript is not tagged', label(dispatch({ description: 'Build it', subagent_type: 'unjobbed-agent' }), d) === null);
  ok('a kit agent default job fills the table family', label(dispatch({ description: 'Build it', subagent_type: 'claude-kit:refactorer' }), d) === '[Sonnet 5.5] Build it');
  ok('local-qwen is a known family: a hand-written tag is replaced', label(dispatch({ description: '[local-qwen] Build it', model: 'haiku' }), d) === '[Haiku 4.5] Build it');

  // project agent pins and inherit
  projectAgent(d, 'proj-pinned', 'model: claude-opus-5-5');
  projectAgent(d, 'proj-inherit', 'model: inherit');
  const tp = transcript(d, ['claude-fable-5', '<synthetic>']);
  ok('project agent pin', label(dispatch({ description: 'Do it', subagent_type: 'proj-pinned' }), d) === '[Opus 5.5] Do it');
  ok('`model: inherit` resolves to the session model, skipping a synthetic turn',
    label(dispatch({ description: 'Do it', subagent_type: 'proj-inherit' }, { transcript_path: tp }), d) === '[Fable 5] Do it');
  ok('no model, no pin: the session model', label(dispatch({ description: 'Do it', subagent_type: 'general-purpose' }, { transcript_path: tp }), d) === '[Fable 5] Do it');

  // tool name, background, field preservation
  const bg = dispatch({ description: 'Do it', model: 'sonnet', run_in_background: true, prompt: 'brief' }, {}, 'Agent');
  const bgOut = JSON.parse(hook('activity-tag.mjs', bg, d).out).hookSpecificOutput;
  ok('tool name Agent and Task give the same label', bgOut.updatedInput.description === '[Sonnet 5.5] Do it');
  ok('a background dispatch keeps every other field and carries no permissionDecision',
    bgOut.updatedInput.run_in_background === true && bgOut.updatedInput.prompt === 'brief' && !('permissionDecision' in bgOut));

  // repo state
  ok('unadopted repo is tagged', label(dispatch({ description: 'Do it', model: 'sonnet' }), repo()) === '[Sonnet 5.5] Do it');
  ok('a directory with no repo at all is tagged', label(dispatch({ description: 'Do it', model: 'sonnet' }), tmpDir('kit-norepo-')) === '[Sonnet 5.5] Do it');

  // hand-written prefixes collapse to the one form
  for (const [typed, want] of [
    ['[opus] Do it', '[Sonnet 5.5] Do it'],
    ['[claude-opus-5-5] Do it', '[Sonnet 5.5] Do it'],
    ['[sonnet55] Do it', '[Sonnet 5.5] Do it'],
    ['[Opus 5] Do it', '[Sonnet 5.5] Do it'],
    ['[Sonnet 5.5] Do it', null],
    ['[KIT-T337] Do it', '[Sonnet 5.5] [KIT-T337] Do it'],
  ]) {
    ok(`hand-written ${typed.split(']')[0]}] -> one form`, label(dispatch({ description: typed, model: 'sonnet' }), d) === want);
  }
  const once = label(dispatch({ description: 'Do it', model: 'sonnet' }), d);
  ok('re-firing on its own output is a no-op', label(dispatch({ description: once, model: 'sonnet' }), d) === null);

  // indeterminate model: no guess, the caller's label stands
  ok('indeterminate model leaves the label alone', label(dispatch({ description: '[opus] Do it', subagent_type: 'general-purpose' }), d) === null);

  // the real launcher and both wiring files
  const launched = spawnSync(process.execPath, [join(HOOKS, 'compat-run.mjs'), 'activity-tag.mjs'], {
    input: JSON.stringify(dispatch({ description: 'Do it', model: 'claude-opus-5-5' })),
    cwd: d, encoding: 'utf8', env: { ...ENV, CLAUDE_PLUGIN_ROOT: ROOT, PLUGIN_ROOT: '' },
  });
  ok('through compat-run (the installed command path) the label is applied',
    /\[Opus 5\.5\] Do it/.test(launched.stdout || ''));
  const jobbed = JSON.parse(hook('activity-tag.mjs', dispatch({ description: 'Fix it', prompt: 'x [job: fix]' }), d).out).hookSpecificOutput.updatedInput;
  ok('a job with no model takes the table family', jobbed.model === 'sonnet' && jobbed.description === '[Sonnet 5.5] Fix it');
  ok('an explicit model is never replaced by the table', label(dispatch({ description: 'Fix it', model: 'opus', prompt: 'x [job: fix]' }), d) === '[Opus 5.5] Fix it');
  const wiring = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const entry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('activity-tag')));
  ok('hooks.json matches both Task and Agent', !!entry && entry.matcher.split('|').includes('Task') && entry.matcher.split('|').includes('Agent'));
} finally {
  cleanup();
}
done();
