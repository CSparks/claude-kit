// ruling-hooks (KIT-T938): the live Stop, PreCompact and SessionStart hooks demand promotion of a maintainer ruling
// that rests in the inbox. Real groovegrid note texts, the real hooks, a throwaway adopted repo.
// Run: node hooks/ruling-hooks.test.mjs

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRIAGE_LINE } from './lib/block-triage.mjs';
import { RULINGS_HEADER } from './lib/ruling-messages.mjs';
import { ROOT, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { REAL_RULINGS, seedInbox } from './inbox-rulings-fixtures.mjs';

const { ok, done } = reporter('ruling-hooks');
const HOUR_S = 3600;
const TURN_AGO_MS = 20000;
const ENV = { KIT_USER: 'chris', CLAUDE_KIT_UNBOUNDED_AI: '' };

function turnTranscript(startedMsAgo) {
  const file = join(tmpDir('ruling-tx-'), 'session.jsonl');
  const ts = new Date(Date.now() - startedMsAgo).toISOString();
  writeFileSync(file, `${JSON.stringify({ type: 'user', timestamp: ts, message: { role: 'user', content: 'what did I say about scenes?' } })}\n`);
  return file;
}

const stamp = () => { const iso = new Date().toISOString(); return `${iso.slice(0, 10)}-${iso.slice(11, 16).replace(':', '')}`; };
const stop = (repo, tx, extra = {}) => hook('flush.mjs', { hook_event_name: 'Stop', session_id: 's1', transcript_path: tx, ...extra }, repo, ENV);

try {
  const fresh = adopted(false);
  const [note] = seedInbox(fresh, [{ file: `${stamp()}-note-fresh.md`, text: REAL_RULINGS[0].text }]);
  const tx = turnTranscript(TURN_AGO_MS);
  const blocked = stop(fresh, tx);
  ok('a ruling captured this turn blocks the Stop', blocked.code === 2 && /BLOCKED: 1 maintainer ruling/.test(blocked.out) && blocked.out.includes(note.replace(/\.md$/, '')));
  ok('the Stop block demands the t decide promotion and the false-match clear', /t decide --file <draft\.md> --from <inbox id>/.test(blocked.out) && /t triage <id> --skip/.test(blocked.out));
  ok('the Stop block ends with the BLOCK TRIAGE line', blocked.out.includes(TRIAGE_LINE));
  ok('the same finding blocks once', stop(fresh, tx).code === 0);
  ok('stop_hook_active never blocks', stop(adopted(false), tx, { stop_hook_active: true }).code === 0);

  const old = adopted(false);
  seedInbox(old, REAL_RULINGS, { secondsAgo: 5 * HOUR_S });
  const warned = stop(old, turnTranscript(TURN_AGO_MS));
  ok('rulings older than the turn warn, naming both, and do not block', warned.code === 0 && /WARNING: 2 maintainer ruling/.test(warned.out) && REAL_RULINGS.every((r) => warned.out.includes(r.file.replace(/\.md$/, ''))));
  ok('negative control: no transcript means no block for a fresh ruling', stop(fresh, undefined).code === 0);

  for (const r of REAL_RULINGS) renameSync(join(old, '.ai', 'inbox', r.file), join(old, '.ai', 'inbox', 'triaged', r.file));
  ok('negative control: promoted or triaged rulings are silent', stop(old, turnTranscript(TURN_AGO_MS)).out === '');

  const pre = hook('flush.mjs', { hook_event_name: 'PreCompact' }, fresh, ENV);
  ok('PreCompact lists the un-promoted ruling', /COMPACTION IMMINENT/.test(pre.out) && /maintainer ruling/.test(pre.out));

  const lit = adopted(false);
  seedInbox(lit, REAL_RULINGS, { secondsAgo: 5 * HOUR_S });
  const orient = hook('orient.mjs', { hook_event_name: 'SessionStart' }, lit, ENV);
  ok('orient lists the un-promoted rulings under their own header with id and age', orient.out.includes(RULINGS_HEADER) && REAL_RULINGS.every((r) => orient.out.includes(r.file.replace(/\.md$/, ''))) && /\s\d+[hd]\s+note Song mode rulings/.test(orient.out));
  ok('negative control: an inbox with no ruling prints no rulings header', !hook('orient.mjs', { hook_event_name: 'SessionStart' }, adopted(false), ENV).out.includes(RULINGS_HEADER));

  const hooks = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command));
  const at = (name) => hooks.findIndex((c) => c.includes(name));
  ok('orient runs before housekeeping, so the rulings precede the generic inbox count', at('orient.mjs') !== -1 && at('orient.mjs') < at('housekeeping.mjs'));
} finally { cleanup(); }
done();
