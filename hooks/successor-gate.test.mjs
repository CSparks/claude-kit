// successor-gate (KIT-T718): an agent that retired with a Handoff block on an open ticket, with no later dispatch
// citing it, blocks the Stop once; a successor dispatch, a closed ticket, a missing handoff, an in-flight agent,
// a stale row, an exclusion and stop_hook_active all pass.
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

const handoff = (id) => `## Notes\n\n### Handoff ${id}\n- Jobs: j-1-a (passed)\n- State: patch landed\n- Next: run the suite\n- Files: hooks/x.mjs:10\n`;
const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();

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
  const blocked = stop();
  ok('a retired agent with a Handoff on an open ticket and no successor blocks the stop and names both', blocked.code === 2 && blocked.out.includes(TICKET) && blocked.out.includes(OLD) && /successor/.test(blocked.out));

  const sid = `repeat-${RUN}`;
  const first = stop({ session_id: sid });
  const second = stop({ session_id: sid });
  ok('the same finding blocks once, then lets the stop through', first.code === 2 && second.code === 0);

  roster(retired(), successor);
  ok('negative: a later dispatch citing the ticket clears it', stop().code === 0);
  roster(retired({ ts: at(HOUR_MS / 4) }), { ...successor, ts: at(HOUR_MS) });
  ok('control: a dispatch that started before the retirement is no successor', stop().code === 2);

  ticket('review', handoff(OLD));
  roster(retired());
  ok('negative: a ticket in review needs no successor', stop().code === 0);

  ticket('doing', '## Notes\n\nnothing yet\n');
  ok('negative: no Handoff block in the Notes does not block', stop().code === 0);

  ticket('doing', handoff(NEW));
  ok('negative: another agent\'s Handoff block does not count', stop().code === 0);

  ticket('doing', handoff(OLD));
  roster(retired({ status: 'in-flight' }));
  ok('negative: an agent still in flight has not retired', stop().code === 0);

  roster(retired({ ts: at(STALE_DAYS * DAY_MS) }));
  ok('negative: a retirement past the window is ignored', stop().code === 0);

  roster(retired());
  ok('stop_hook_active allows', stop({ stop_hook_active: true }).code === 0);

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), `successor:\n  - "${TICKET}"\n`);
  ok('.claude-kit-ignore.yaml glob over the ticket id excludes it', stop().code === 0);
  ok('wired into the Stop list', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8')).hooks.Stop.some((e) => e.hooks.some((h) => h.command.includes('successor-gate.mjs'))));
} finally {
  cleanup();
}

done();
