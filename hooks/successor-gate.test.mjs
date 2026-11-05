// successor-gate (KIT-T718, KIT-D132): an agent that retired with a Handoff block on an open ticket, with no later dispatch
// citing it, makes the Stop print an OPEN notice once per distinct set and exit 0 (never blocks, never orders a dispatch);
// a successor dispatch, a closed ticket, a missing handoff, an in-flight agent, a stale row, an exclusion and
// stop_hook_active print nothing.
// Run: node hooks/successor-gate.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter } from './test-harness.mjs';

const RUN = `${process.pid}-${Date.now()}`;
const { ok, done } = reporter('successor-gate');
const OLD = 'a1b2c3d4e5f6a7b8c';
const NEW = 'b2c3d4e5f6a7b8c9d';
const TICKET = 'KIT-T900';
const HOUR_MS = 3600000;
const STALE_DAYS = 30;
const DAY_MS = 24 * HOUR_MS;
const NOTICE = /OPEN, awaiting a bill of work/;

const handoff = (id) => `## Notes\n\n### Handoff ${id}\n- Jobs: j-1-a (passed)\n- State: patch landed\n- Next: run the suite\n- Files: hooks/x.mjs:10\n`;
const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const noticed = (r) => r.code === 0 && NOTICE.test(r.out);
const silent = (r) => r.code === 0 && !NOTICE.test(r.out);

try {
  const d = adopted(false);
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  const ticket = (status, notes) => writeFileSync(join(d, '.ai', 'tickets', `${TICKET}-thing.md`), `---\nid: ${TICKET}\nstatus: ${status}\n---\n\n${notes}`);
  const roster = (...rows) => writeFileSync(join(d, '.ai', 'agents.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const retired = (extra = {}) => ({ ts: at(HOUR_MS), id: OLD, scope: 'implementer', model: 'claude-sonnet-5-5', status: 'done', task: 'work', tickets: [TICKET], ...extra });
  const successor = { ts: at(HOUR_MS / 2), id: NEW, scope: 'implementer', model: 'claude-sonnet-5-5', status: 'in-flight', task: 'continue', tickets: [TICKET] };
  let n = 0;
  const stop = (extra = {}) => hook('successor-gate.mjs', { hook_event_name: 'Stop', session_id: `s${RUN}-${n++}`, ...extra }, d);

  ticket('doing', handoff(OLD));
  roster(retired());
  const open = stop();
  ok('a Stop with an open handoff exits 0 and prints the OPEN notice naming ticket and agent', noticed(open) && open.out.includes(TICKET) && open.out.includes(OLD));
  ok('the notice orders nothing: no BLOCKED, no instruction to dispatch', !/BLOCKED/.test(open.out) && !/DISPATCH NOW|no maintainer input/i.test(open.out) && /Relay this to the maintainer/.test(open.out));

  const sid = `repeat-${RUN}`;
  ok('the first Stop of a session prints the notice', noticed(stop({ session_id: sid })));
  ok('an unchanged set is not repeated at the next stop of that session', silent(stop({ session_id: sid })));
  ok('stop_hook_active prints nothing', silent(stop({ session_id: sid, stop_hook_active: true })));

  roster(retired(), successor);
  ok('negative: a later dispatch citing the ticket clears it', silent(stop()));
  roster(retired({ ts: at(HOUR_MS / 4) }), { ...successor, ts: at(HOUR_MS) });
  ok('control: a dispatch that started before the retirement is no successor', noticed(stop()));

  ticket('review', handoff(OLD));
  roster(retired());
  ok('negative: a ticket in review has nothing open', silent(stop()));

  ticket('doing', '## Notes\n\nnothing yet\n');
  ok('negative: no Handoff block in the Notes prints nothing', silent(stop()));

  ticket('doing', handoff(NEW));
  ok('negative: another agent\'s Handoff block does not count', silent(stop()));

  ticket('doing', handoff(OLD));
  roster(retired({ status: 'in-flight' }));
  ok('negative: an agent still in flight has not retired', silent(stop()));

  roster(retired({ ts: at(STALE_DAYS * DAY_MS) }));
  ok('negative: a retirement past the window is ignored', silent(stop()));

  roster(retired({ scope: 'Explore' }));
  ok('negative: a read-only built-in type that names the ticket leaves nothing open', silent(stop()));
  roster(retired({ scope: 'claude-kit:researcher' }));
  ok('negative: a read-only definition (researcher) leaves nothing open', silent(stop()));
  roster(retired({ readOnly: true }));
  ok('negative: a row declared read-only leaves nothing open', silent(stop()));
  roster(retired({ scope: 'general-purpose' }));
  ok('control: a writer-capable type with a Handoff still prints the notice', noticed(stop()));

  roster(retired());
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), `successor:\n  - "${TICKET}"\n`);
  ok('.claude-kit-ignore.yaml glob over the ticket id excludes it', silent(stop()));
  ok('wired into the Stop list', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks.Stop.some((e) => e.hooks.some((h) => h.command.includes('successor-gate.mjs'))));
} finally {
  cleanup();
}

done();
