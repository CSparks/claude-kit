// kit-bug-dispatch-gate (KIT-T699): a high/critical kit ticket seen this session with no Agent call naming
// it blocks the Stop once; a dispatch, a low priority, an unseen id and stop_hook_active all pass.
// Run: node hooks/kit-bug-dispatch-gate.test.mjs

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, HOOKS, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const RUN = `${process.pid}-${Date.now()}`;
const { ok, done } = reporter('kit-bug-dispatch-gate');
const store = tmpDir('kit-dispatch-store-');
mkdirSync(join(store, '.ai', 'tickets'), { recursive: true });
copyFileSync(join(ROOT, '.ai', 'config.yml'), join(store, '.ai', 'config.yml'));
const ticket = (id, priority) => writeFileSync(join(store, '.ai', 'tickets', `${id}-t.md`), ['---', `id: ${id}`, `title: ${id} broken thing`, 'type: bug', 'status: todo', `priority: ${priority}`, 'labels: [kit-bug]', 'created: 2026-10-29T00:00:00Z', '---', ''].join('\n'));
ticket('KIT-T801', 'high');
ticket('KIT-T802', 'critical');
ticket('KIT-T803', 'low');

try {
  const d = adopted(false);
  const dir = tmpDir('kit-dispatch-tr-');
  let n = 0;
  const transcript = (...entries) => { const f = join(dir, `t${n++}.jsonl`); writeFileSync(f, entries.map((e) => JSON.stringify(e)).join('\n')); return f; };
  const say = (text) => ({ message: { content: [{ type: 'text', text }] } });
  const agent = (prompt) => ({ message: { content: [{ type: 'tool_use', name: 'Agent', input: { prompt } }] } });
  const stop = (file, extra = {}) => hook('kit-bug-dispatch-gate.mjs', { hook_event_name: 'Stop', session_id: `s${RUN}-${n++}`, transcript_path: file, ...extra }, d, { CLAUDE_KIT_BUG_STORE: store });

  const seen = stop(transcript(say('filed KIT-T801 and KIT-T802 just now')));
  ok('high and critical tickets seen with no dispatch block the stop and name both', seen.code === 2 && /KIT-T801/.test(seen.out) && /KIT-T802/.test(seen.out) && /dispatch/i.test(seen.out) && /kit-bug-dispatch/.test(seen.out));
  ok('negative: a low-priority ticket alone does not block', stop(transcript(say('filed KIT-T803'))).code === 0);
  ok('negative: a ticket never mentioned this session does not block', stop(transcript(say('nothing relevant'))).code === 0);
  ok('negative: an Agent call naming the id clears it', stop(transcript(say('KIT-T801'), agent('fix KIT-T801 in the claude-kit checkout'))).code === 0);
  ok('only the undispatched id is named when one of two is dispatched', (() => { const r = stop(transcript(say('KIT-T801 KIT-T802'), agent('KIT-T801 please'))); return r.code === 2 && /KIT-T802/.test(r.out) && !/KIT-T801 \[/.test(r.out); })());
  ok('stop_hook_active allows', stop(transcript(say('KIT-T801')), { stop_hook_active: true }).code === 0);

  const file = transcript(say('KIT-T802 again'));
  const sid = `repeat-${RUN}`;
  const first = hook('kit-bug-dispatch-gate.mjs', { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d, { CLAUDE_KIT_BUG_STORE: store });
  const second = hook('kit-bug-dispatch-gate.mjs', { hook_event_name: 'Stop', session_id: sid, transcript_path: file }, d, { CLAUDE_KIT_BUG_STORE: store });
  ok('the same finding blocks once, then lets the stop through', first.code === 2 && second.code === 0);

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'kit-bug-dispatch:\n  - "KIT-T801"\n');
  ok('.claude-kit-ignore.yaml glob over the ticket id excludes it', stop(transcript(say('KIT-T801'))).code === 0);
  ok('fail-open on a missing transcript', stop('/no/such/file.jsonl').code === 0);
  ok('wired into the Stop list', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks.Stop.some((e) => e.hooks.some((h) => h.command.includes('kit-bug-dispatch-gate.mjs'))));
} finally {
  cleanup();
}

done();
