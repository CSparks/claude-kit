#!/usr/bin/env node
// Tests for the UNBOUNDED catch-all store (KIT-T189) — the store a session with no `.ai`
// above its cwd resolves to. Drives the REAL CLIs and hooks in throwaway fixtures, so the
// resolution rule, the per-item identity stamping, the topic views, `t move` and the
// commit gate's continued repo-scoping are all exercised end to end.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpDir, script, hook, cleanup, reporter, ENV, SCRIPTS, repo, identify } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('unbounded');

// A cwd with NO .ai anywhere above it — the situation the whole feature exists for.
const loose = () => tmpDir('kit-unb-cwd-');

// Scaffold the catch-all store at a throwaway path via the kit's own init script.
function store() {
  const ai = join(tmpDir('kit-unb-store-'), 'unbounded', '.ai');
  const env = { ...ENV, CLAUDE_KIT_UNBOUNDED_AI: ai };
  const r = spawnSync(process.execPath, [join(SCRIPTS, 'init-unbounded.mjs')], { encoding: 'utf8', env });
  return { ai, env, out: `${r.stdout}${r.stderr}`, code: r.status };
}

function inboxFiles(ai) {
  try {
    return readdirSync(join(ai, 'inbox')).filter((f) => f.endsWith('.md') && !/^README/i.test(f));
  } catch {
    return [];
  }
}

// A managed destination repo for the promotion tests.
function managed(key = 'DST') {
  const d = identify(repo());
  mkdirSync(join(d, '.ai', 'inbox'), { recursive: true });
  mkdirSync(join(d, '.ai', 'notes'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'),
    `classifications:\n  decision: { routes_to: decisions, blocking: never }\n  observation: { routes_to: notes, blocking: never }\nids:\n  key: "${key}"\n  prefix: "${key}-T"\n  pad: 3\n`);
  return d;
}

try {
  // --- init + resolution fallback ------------------------------------------------------
  const s = store();
  ok('init-unbounded scaffolds the standard layout', s.code === 0 && existsSync(join(s.ai, 'config.yml')) && existsSync(join(s.ai, 'inbox')));
  ok('init-unbounded derives an ids key', /key:\s*"UNB"/.test(readFileSync(join(s.ai, 'config.yml'), 'utf8')));

  const cwd = loose();
  const cap = (args, env = s.env) => {
    const r = spawnSync(process.execPath, [join(SCRIPTS, 'cap.mjs'), ...args], { cwd, encoding: 'utf8', env });
    return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
  };

  const c1 = cap(['decision', 'the V100 lane is the daily driver']);
  ok('cap falls back to the unbounded store when no .ai is above the cwd', c1.code === 0 && inboxFiles(s.ai).length === 1);

  // With NOTHING configured, cap keeps its historical refusal — the fallback never invents a store.
  const bare = cap(['a stray thought'], { ...ENV, CLAUDE_KIT_UNBOUNDED_AI: join(tmpDir('kit-unb-none-'), 'nope', '.ai') });
  ok('no configured store -> cap still refuses, naming the fix', bare.code === 1 && /not initialized/.test(bare.err));

  // --- topic identity ------------------------------------------------------------------
  ok('cap topic reports none before one is set', cap(['topic']).out.includes('(none set)'));
  ok('cap topic sets a slug', cap(['topic', 'llm-rig']).out.trim() === 'topic: llm-rig');
  ok('cap topic normalizes to a slug', cap(['topic', 'Comfy Volta!']).out.includes('topic: comfy-volta (was llm-rig)'));
  cap(['topic', 'llm-rig']);

  cap(['decision', 'the tray icon lives with the server process']);
  const stamped = inboxFiles(s.ai).map((f) => readFileSync(join(s.ai, 'inbox', f), 'utf8'));
  const withTopic = stamped.filter((t) => /^topic: llm-rig$/m.test(t));
  ok('a capture is stamped with the session topic', withTopic.length === 1);
  ok('the first capture predates the topic and carries none', stamped.filter((t) => /^topic:/m.test(t)).length === 1);
  ok('the item title is still the first line', /^\(decision\) the tray icon/m.test(withTopic[0]));

  // --- session identity, written by SessionStart ----------------------------------------
  const orient = hook('orient.mjs', { hook_event_name: 'SessionStart', session_id: 'sess-aaaa-1111' }, cwd, s.env);
  ok('orient orients an unbounded session instead of no-op\'ing', orient.code === 0 && /UNBOUNDED SESSION/.test(orient.out));
  ok('orient asks for a topic when none is set', /NONE SET/.test(orient.out));
  ok('a new session id clears the previous session\'s topic', JSON.parse(readFileSync(join(s.ai, '.session'), 'utf8')).topic === '');
  ok('the session id is persisted for the CLIs', JSON.parse(readFileSync(join(s.ai, '.session'), 'utf8')).session === 'sess-aaaa-1111');

  cap(['topic', 'comfy-volta']);
  cap(['observation', 'MiniMax H3 wants --fp16-unet on Volta']);
  const sessioned = inboxFiles(s.ai)
    .map((f) => readFileSync(join(s.ai, 'inbox', f), 'utf8'))
    .filter((t) => /^session: sess-aaaa-1111$/m.test(t));
  ok('a capture is stamped with the session id', sessioned.length === 1 && /^topic: comfy-volta$/m.test(sessioned[0]));

  // --- retrieval -------------------------------------------------------------------------
  const q = (args) => {
    const r = spawnSync(process.execPath, [join(SCRIPTS, 'q.mjs'), ...args], { cwd, encoding: 'utf8', env: s.env });
    return `${r.stdout || ''}${r.stderr || ''}`;
  };
  const topics = q(['topics']);
  ok('q topics indexes both topics with counts', /llm-rig\s+\S+\s+\S+\s+1/.test(topics) && /comfy-volta\s+\S+\s+\S+\s+1/.test(topics));
  ok('q --topic returns only that topic', q(['--topic', 'llm-rig']).includes('tray icon') && !q(['--topic', 'llm-rig']).includes('MiniMax'));
  ok('q topic <slug> is the same view', q(['topic', 'comfy-volta']).includes('MiniMax'));
  ok('an unknown topic returns nothing', q(['--topic', 'no-such-thing']).includes('(no results)'));

  // A DURABLE item spells its identity in frontmatter, and a triaged capture keeps the trailing
  // lines in its body — both must reach the topic index (KIT-T189).
  mkdirSync(join(s.ai, 'decisions'), { recursive: true });
  writeFileSync(join(s.ai, 'decisions', 'UNB-D001-fm.md'),
    '---\nid: UNB-D001\ntitle: frontmatter identity\ntopic: llm-rig\nsession: sess-aaaa-1111\n---\n\nbody\n');
  writeFileSync(join(s.ai, 'decisions', 'UNB-D002-body.md'),
    '---\nid: UNB-D002\ntitle: triaged capture\n---\n\n## Description\nkept text\n\ntopic: llm-rig\n');
  const both = q(['--topic', 'llm-rig']);
  ok('frontmatter topic is indexed', both.includes('UNB-D001'));
  ok('a promoted capture keeps its body-spelled topic', both.includes('UNB-D002'));

  // --- promotion: t move ------------------------------------------------------------------
  const dest = managed();
  const capId = q(['--topic', 'comfy-volta']).trim().split(/\s+/)[0];
  const mv = script('t.mjs', ['move', capId, dest], cwd, s.env);
  ok('t move promotes a capture into the destination inbox', mv.code === 0 && inboxFiles(join(dest, '.ai')).length === 1);
  ok('t move leaves a pointer in inbox/triaged', existsSync(join(s.ai, 'inbox', 'triaged')) && readdirSync(join(s.ai, 'inbox', 'triaged')).length === 1);
  ok('the promoted copy records where it came from',
    /moved-from: /.test(readFileSync(join(dest, '.ai', 'inbox', inboxFiles(join(dest, '.ai'))[0]), 'utf8')));
  ok('the pointer records where it went',
    /moved-to: /.test(readFileSync(join(s.ai, 'inbox', 'triaged', readdirSync(join(s.ai, 'inbox', 'triaged'))[0]), 'utf8')));

  // A keyed item is RE-KEYED into the destination and keeps the old id as an alias.
  mkdirSync(join(s.ai, 'notes'), { recursive: true });
  writeFileSync(join(s.ai, 'notes', 'UNB-N001-h3.md'),
    '---\nid: UNB-N001\ntitle: H3 fp16 recipe\ntype: note\nstatus: todo\n---\n\n## History\n- [2026-08-25 03:00] (created) note — H3 fp16 recipe\n');
  const mv2 = script('t.mjs', ['move', 'UNB-N001', dest], cwd, s.env);
  const moved = readdirSync(join(dest, '.ai', 'notes'));
  const movedText = moved.length ? readFileSync(join(dest, '.ai', 'notes', moved[0]), 'utf8') : '';
  ok('t move re-keys a durable item to the destination scheme', mv2.code === 0 && /^id: DST-N001$/m.test(movedText));
  ok('t move keeps the old id as an aka alias', /^aka: \[UNB-N001\]$/m.test(movedText));
  ok('t move preserves the item history', /\(created\) note — H3 fp16 recipe/.test(movedText));
  const ptr = readFileSync(join(s.ai, 'notes', 'UNB-N001-h3.md'), 'utf8');
  ok('the durable source becomes an off-board pointer', /^status: superseded$/m.test(ptr) && /^moved_to: DST-N001$/m.test(ptr));
  ok('t move refuses an unknown id', script('t.mjs', ['move', 'UNB-N999', dest], cwd, s.env).code !== 0);

  // --- the commit gate stays REPO-scoped --------------------------------------------------
  const gate = hook('commit-gate.mjs',
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } }, cwd, s.env);
  ok('the commit gate does not fire outside a repo, even with an unbounded store', gate.code === 0 && gate.out.trim() === '');
} finally {
  cleanup();
}
done();
