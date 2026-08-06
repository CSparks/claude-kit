// Tests for KIT-T179 — every delegated subagent carries its model where the work is watched.
//   1. display: the DATED lineup map — aliases, full ids, provider prefixes, unknown verbatim,
//      and the generation guard (claude-opus-4-1 must NOT read as "Opus 5").
//   2. resolution: explicit model -> agent-definition pin -> session model from the transcript.
//   3. tag: prepend is idempotent, an author's own bracket survives, strip is the inverse.
//   4. the hook: rewrites description via hookSpecificOutput.updatedInput, emits NO
//      permissionDecision (so it can never weaken dispatch-guard on the same event), and
//      fails open on garbage / unadopted / model-less dispatches.
//   5. roster: the dispatch row records the model; the task label does not double the tag.
//   6. orient: in-flight and finished lines render `(scope [Opus 5])`, and a pre-T179 row
//      without a model renders exactly as it always did.
//   7. wiring: both install paths (plugin hooks.json + bootstrap settings) register the hook.
// Run: node hooks/model-tag.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { recordAgent, agentsPath, readAgents } from './lib.mjs';
import { modelDisplay, resolveDispatchModel, tagDescription, stripModelTag, pinnedModel, latestAssistantModel } from './model-tag.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, 'activity-tag.mjs');
const ROSTER = join(HERE, 'agent-roster.mjs');
const ORIENT = join(HERE, 'orient.mjs');
const ROOT = join(HERE, '..');
const fixtures = [];
let pass = 0;
let fail = 0;

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// Isolate every spawned hook from the real ~/.claude registry (orient self-heals it).
const TMP_REG = join(mkdtempSync(join(tmpdir(), 'kit-mt-reg-')), 'registry.json');
fixtures.push(dirname(TMP_REG));
const ENV = { ...process.env, CLAUDE_KIT_REGISTRY: TMP_REG };

function makeRepo({ adopt = true, commit = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-mt-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir, stdio: 'ignore' });
  if (adopt) mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
  if (commit) {
    writeFileSync(join(dir, 'seed.txt'), 'x\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir, stdio: 'ignore' });
  }
  return dir;
}

function hook(hookPath, payload, cwd, raw) {
  const input = raw === undefined ? JSON.stringify(payload) : raw;
  const r = spawnSync(process.execPath, [hookPath], { input, cwd, encoding: 'utf8', env: ENV });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

// The hook's JSON verdict, or null when it declined to say anything (the fail-open shape).
function verdict(res) {
  const text = res.out.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return 'UNPARSEABLE'; }
}

function agentDef(dir, name, body) {
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', `${name}.md`), body);
  return dir;
}

function transcript(dir, model) {
  const p = join(dir, 'transcript.jsonl');
  writeFileSync(p, [
    JSON.stringify({ type: 'user', message: { role: 'user' } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', model } }),
  ].join('\n') + '\n');
  return p;
}

const dispatch = (input, extra = {}) => ({
  hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: input, ...extra,
});

try {
  // ===== 1. the display map (DATED lineup fact) ==============================
  {
    ok('display: the opus alias', modelDisplay('opus') === 'Opus 5');
    ok('display: the fable alias', modelDisplay('fable') === 'Fable 5');
    ok('display: the sonnet alias', modelDisplay('sonnet') === 'Sonnet 5');
    ok('display: the haiku alias', modelDisplay('haiku') === 'Haiku 4.5');
    ok('display: a full opus id', modelDisplay('claude-opus-5') === 'Opus 5');
    ok('display: a dated opus id', modelDisplay('claude-opus-5-20260101') === 'Opus 5');
    ok('display: a context-suffixed opus id', modelDisplay('claude-opus-5[1m]') === 'Opus 5');
    ok('display: a full fable id', modelDisplay('claude-fable-5') === 'Fable 5');
    ok('display: a full haiku id', modelDisplay('claude-haiku-4-5-20251001') === 'Haiku 4.5');
    ok('display: a bedrock-prefixed id', modelDisplay('us.anthropic.claude-sonnet-5-v1:0') === 'Sonnet 5');
    ok('display: case is not significant', modelDisplay('OPUS') === 'Opus 5');
    ok('display: surrounding whitespace is trimmed', modelDisplay('  opus  ') === 'Opus 5');
    // The generation guard: a bare /opus/ match would quietly relabel a previous generation.
    ok('display: a PRIOR-generation opus is NOT relabelled', modelDisplay('claude-opus-4-1-20250805') === 'claude-opus-4-1-20250805');
    ok('display: an unknown model passes through verbatim', modelDisplay('gpt-5') === 'gpt-5');
    ok('display: an absent model yields no tag', modelDisplay('') === '' && modelDisplay(undefined) === '' && modelDisplay(null) === '');
  }

  // ===== 2. resolution precedence ===========================================
  {
    const d = makeRepo();
    // Names that do NOT collide with a shipped kit agent: the probe order puts the kit's own
    // agents/ ahead of the project's, so a colliding name would test the wrong definition.
    agentDef(d, 'proj-splitter', '---\nname: proj-splitter\nmodel: haiku\n---\nbody\n');
    agentDef(d, 'proj-unpinned', '---\nname: proj-unpinned\n---\nbody\n');
    const tp = transcript(d, 'claude-fable-5');

    ok('resolve: an explicit model on the call wins over everything',
      resolveDispatchModel(d, { model: 'sonnet', subagent_type: 'proj-splitter' }, { transcript_path: tp }) === 'sonnet');
    ok('resolve: a project agent-definition pin beats the session model',
      resolveDispatchModel(d, { subagent_type: 'proj-splitter' }, { transcript_path: tp }) === 'haiku');
    ok('resolve: a plugin-scoped agent name resolves to the same pin',
      resolveDispatchModel(d, { subagent_type: 'claude-kit:researcher' }, { transcript_path: tp }) === 'claude-opus-5');
    ok('resolve: an UNPINNED definition falls through to the session model',
      resolveDispatchModel(d, { subagent_type: 'proj-unpinned' }, { transcript_path: tp }) === 'claude-fable-5');
    ok('resolve: no model, no pin, no transcript -> indeterminate',
      resolveDispatchModel(d, { subagent_type: 'nope' }, {}) === '');
    ok('resolve: an empty explicit model does not shadow the pin',
      resolveDispatchModel(d, { model: '   ', subagent_type: 'proj-splitter' }, {}) === 'haiku');
    ok('resolve: garbage input is indeterminate, never a throw',
      resolveDispatchModel(d, {}, {}) === '' && resolveDispatchModel(null, undefined, undefined) === '');
    ok('resolve: the kit agents are pinned in their own definitions (the shipped ladder)',
      pinnedModel(ROOT, 'researcher') === 'claude-opus-5');
    ok('resolve: an unreadable transcript is indeterminate',
      latestAssistantModel(join(d, 'nope.jsonl')) === '' && latestAssistantModel('') === '');
  }

  // ===== 3. tag / strip =====================================================
  {
    ok('tag: prepends the display name', tagDescription('Build CRX-T024 admin foundation', 'Opus 5') === '[Opus 5] Build CRX-T024 admin foundation');
    ok('tag: IDEMPOTENT — never double-prepends the same tag',
      tagDescription('[Opus 5] Build CRX-T024', 'Opus 5') === '[Opus 5] Build CRX-T024');
    ok('tag: a description already tagged with ANOTHER model is left alone',
      tagDescription('[Fable 5] Plan the epic', 'Opus 5') === '[Fable 5] Plan the epic');
    ok('tag: a previously-tagged unknown model still counts as tagged',
      tagDescription('[gpt-5] do the thing', 'Opus 5') === '[gpt-5] do the thing');
    ok("tag: an AUTHOR's own bracket is not mistaken for a tag",
      tagDescription('[CRX-T024] fix the header', 'Opus 5') === '[Opus 5] [CRX-T024] fix the header');
    ok('tag: no display -> unchanged', tagDescription('Build it', '') === 'Build it');
    ok('tag: a non-string description does not throw', tagDescription(undefined, 'Opus 5') === '[Opus 5] ');

    ok('strip: removes a model tag', stripModelTag('[Opus 5] Build CRX-T024') === 'Build CRX-T024');
    ok('strip: removes a raw-id tag', stripModelTag('[claude-opus-5] Build CRX-T024') === 'Build CRX-T024');
    ok("strip: leaves the author's own bracket", stripModelTag('[CRX-T024] fix the header') === '[CRX-T024] fix the header');
    ok('strip: is a no-op on an untagged description', stripModelTag('Build CRX-T024') === 'Build CRX-T024');
    ok('strip: round-trips with tag', stripModelTag(tagDescription('Build CRX-T024', 'Opus 5')) === 'Build CRX-T024');
  }

  // ===== 4. the hook — the activity-line rewrite ============================
  {
    const d = makeRepo();
    const res = hook(HOOK, dispatch({ description: 'Build CRX-T024 admin foundation', subagent_type: 'general-purpose', model: 'opus', prompt: 'the brief' }), d);
    const v = verdict(res);
    ok('hook: exits 0 (a cosmetic rewrite never gates)', res.code === 0);
    ok('hook: the activity line carries the model tag',
      v && v.hookSpecificOutput.updatedInput.description === '[Opus 5] Build CRX-T024 admin foundation');
    ok('hook: names the PreToolUse event the contract expects',
      v && v.hookSpecificOutput.hookEventName === 'PreToolUse');
    // updatedInput is a FULL replacement of tool_input — dropping a field would silently
    // rewrite the dispatch itself, which is the one thing a cosmetic hook must never do.
    ok('hook: updatedInput preserves every other input field',
      v && v.hookSpecificOutput.updatedInput.subagent_type === 'general-purpose'
        && v.hookSpecificOutput.updatedInput.model === 'opus'
        && v.hookSpecificOutput.updatedInput.prompt === 'the brief');
    // dispatch-guard blocks on this SAME event; an "allow" here could promote its deny.
    ok('hook: emits NO permissionDecision (cannot weaken dispatch-guard)',
      v && !('permissionDecision' in v.hookSpecificOutput));

    ok('hook: an already-tagged description is left alone (no output)',
      verdict(hook(HOOK, dispatch({ description: '[Opus 5] Build CRX-T024', model: 'opus' }), d)) === null);
    ok('hook: an indeterminate model says nothing rather than guessing',
      verdict(hook(HOOK, dispatch({ description: 'Build CRX-T024', subagent_type: 'general-purpose' }), d)) === null);
    ok('hook: a dispatch with no description is a no-op',
      verdict(hook(HOOK, dispatch({ model: 'opus', prompt: 'no description here' }), d)) === null);
    ok('hook: a blank description is a no-op',
      verdict(hook(HOOK, dispatch({ description: '   ', model: 'opus' }), d)) === null);

    const pinned = makeRepo();
    agentDef(pinned, 'proj-splitter', '---\nname: proj-splitter\nmodel: haiku\n---\n');
    const pv = verdict(hook(HOOK, dispatch({ description: 'Split the KIT-T179 monolith', subagent_type: 'proj-splitter' }), pinned));
    ok('hook: a definition-pinned agent is tagged from its frontmatter',
      pv && pv.hookSpecificOutput.updatedInput.description === '[Haiku 4.5] Split the KIT-T179 monolith');
    const kv = verdict(hook(HOOK, dispatch({ description: 'Research the KIT-T179 surface', subagent_type: 'claude-kit:researcher' }), pinned));
    ok('hook: a shipped kit agent is tagged from its own pinned tier',
      kv && kv.hookSpecificOutput.updatedInput.description === '[Opus 5] Research the KIT-T179 surface');

    const sess = makeRepo();
    const tp = transcript(sess, 'claude-fable-5');
    const sv = verdict(hook(HOOK, dispatch({ description: 'Plan the epic', subagent_type: 'general-purpose' }, { transcript_path: tp }), sess));
    ok('hook: an inherited session model is tagged as what it will actually cost',
      sv && sv.hookSpecificOutput.updatedInput.description === '[Fable 5] Plan the epic');

    // FAIL-OPEN + opt-in: never a block, never a rewrite outside an adopted repo.
    const un = makeRepo({ adopt: false });
    const unres = hook(HOOK, dispatch({ description: 'Build it', model: 'opus' }), un);
    ok('hook: no-ops on an unadopted repo', unres.code === 0 && verdict(unres) === null);
    const bad = hook(HOOK, null, d, '{not json at all');
    ok('hook: fails open on malformed stdin', bad.code === 0 && verdict(bad) === null);
    const empty = hook(HOOK, null, d, '');
    ok('hook: fails open on empty stdin', empty.code === 0 && verdict(empty) === null);
    const wrong = hook(HOOK, { hook_event_name: 'PreToolUse', tool_input: 'not an object' }, d);
    ok('hook: fails open on a wrong-shaped tool_input', wrong.code === 0 && verdict(wrong) === null);
  }

  // ===== 5. the roster row ==================================================
  {
    const d = makeRepo();
    hook(ROSTER, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_input: { description: '[Opus 5] Build KIT-T179 admin foundation', subagent_type: 'general-purpose', model: 'opus' },
      tool_response: { agent_id: 'a0179' },
    }, d);
    const row = readAgents(d).find((r) => r.id === 'a0179');
    ok('roster: the dispatch row records the resolved model', !!row && row.model === 'opus');
    ok('roster: the task label does not double the tag already on the line',
      !!row && row.task === 'Build KIT-T179 admin foundation');
    ok('roster: the pre-existing fields are untouched',
      !!row && row.scope === 'general-purpose' && row.status === 'in-flight' && !!row.targetRoot);

    const d2 = makeRepo();
    hook(ROSTER, {
      hook_event_name: 'PostToolUse', tool_name: 'Task',
      tool_input: { description: 'Do KIT-T179 work', subagent_type: 'general-purpose' },
      tool_response: { agent_id: 'a0180' },
    }, d2);
    const row2 = readAgents(d2).find((r) => r.id === 'a0180');
    ok('roster: an indeterminate model records an empty field, never a guess',
      !!row2 && row2.model === '');
  }

  // ===== 6. the orient render ===============================================
  {
    const d = makeRepo({ commit: true });
    recordAgent(d, { id: 'amodel01', status: 'in-flight', task: 'Build KIT-T179', scope: 'general-purpose', model: 'opus' });
    recordAgent(d, { id: 'amodel02', status: 'done', task: 'Plan KIT-T179', scope: 'researcher', model: 'claude-fable-5' });
    const out = hook(ORIENT, { hook_event_name: 'SessionStart' }, d).out;
    ok('orient: an in-flight agent shows its model beside its scope',
      /\[in-flight\] amodel01 \(general-purpose \[Opus 5\]\)/.test(out));
    ok('orient: a finished agent shows its model too',
      /\[done\] amodel02 \(researcher \[Fable 5\]\)/.test(out));

    // BACK-COMPAT: rows written before the field existed must render exactly as they did.
    const old = makeRepo({ commit: true });
    writeFileSync(agentsPath(old), JSON.stringify({
      ts: new Date().toISOString(), id: 'aold01', status: 'in-flight', task: 'legacy row', scope: 'general-purpose',
    }) + '\n');
    const oldOut = hook(ORIENT, { hook_event_name: 'SessionStart' }, old).out;
    ok('orient: a pre-KIT-T179 row renders unchanged (no empty brackets)',
      /\[in-flight\] aold01 \(general-purpose\) — legacy row/.test(oldOut) && !/\(general-purpose \[/.test(oldOut));

    // An unknown model is shown verbatim rather than dropped — honest beats tidy.
    const unk = makeRepo({ commit: true });
    recordAgent(unk, { id: 'aunk01', status: 'in-flight', task: 'odd model', scope: 'general-purpose', model: 'gpt-5' });
    ok('orient: an unknown model renders verbatim',
      /\[in-flight\] aunk01 \(general-purpose \[gpt-5\]\)/.test(hook(ORIENT, { hook_event_name: 'SessionStart' }, unk).out));
  }

  // ===== 7. wiring parity (both install paths) ==============================
  {
    const registers = (file, needle) => {
      const wiring = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
      const entry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes(needle)));
      return !!entry && /\bTask\b/.test(entry.matcher) && /\bAgent\b/.test(entry.matcher);
    };
    ok('wiring: the plugin registers activity-tag on Task|Agent', registers('hooks/hooks.json', 'activity-tag'));
    ok('wiring: the bootstrap settings register it too (KIT-T069 parity)',
      registers('user-config/settings.recommended.json', 'activity-tag'));
  }

  console.log(`\nmodel-tag: ${pass} passed, ${fail} failed`);
} finally {
  for (const f of fixtures) { try { rmSync(f, { recursive: true, force: true }); } catch { /* best effort */ } }
}

process.exit(fail ? 1 : 0);
