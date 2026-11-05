// handoff close (KIT-T830, KIT-D132): a handoff that owes nothing stops being listed, and a worker owes only the tickets
// its task label names. A real open handoff is still listed as a notice (exit 0).
// Run: node hooks/handoff-close.test.mjs

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { closeHandoffs } from '../scripts/broker/handoff-close.mjs';

const RUN = `${process.pid}-${Date.now()}`;
const { ok, done } = reporter('handoff-close');
const AGENT = 'a1b2c3d4e5f6a7b8c';
const OTHER = 'b2c3d4e5f6a7b8c9d';
const MAIN = 'KIT-T900';
const MENTIONED = 'KIT-T901';
const HOUR_MS = 3600000;
const NOTICE = /OPEN, awaiting a bill of work/;

const handoff = (id, next) => `## Notes\n\n### Handoff ${id}\n- Jobs: none running\n- State: measured\n- Next: ${next}\n- Files: hooks/x.mjs\n`;
const noticed = (r) => r.code === 0 && NOTICE.test(r.out);
const quiet = (r) => r.code === 0 && !NOTICE.test(r.out);

try {
  const d = adopted(false);
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  const file = (id) => join(d, '.ai', 'tickets', `${id}-thing.md`);
  const ticket = (id, notes) => writeFileSync(file(id), `---\nid: ${id}\nstatus: doing\n---\n\n${notes}\n## History\n`);
  const row = (extra = {}) => ({ ts: new Date(Date.now() - HOUR_MS).toISOString(), id: AGENT, scope: 'implementer', model: 'claude-sonnet-5-5', status: 'done', task: `${MAIN} job 1 measure`, tickets: [MAIN], ...extra });
  const roster = (...rows) => writeFileSync(join(d, '.ai', 'agents.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const comment = (_root, id, text) => appendFileSync(file(id), `- [2026-11-02 18:00] (comment) @orchestrator: ${text}\n`);
  let n = 0;
  const stop = () => hook('successor-gate.mjs', { hook_event_name: 'Stop', session_id: `s${RUN}-${n++}`, cwd: d }, d);

  ticket(MAIN, handoff(AGENT, 'run the suite, then land'));
  roster(row());
  ok('control: a real open handoff (Next has work) is noticed and names the close command', (() => { const r = stop(); return noticed(r) && r.out.includes(MAIN) && r.out.includes('--handoff'); })());

  ticket(MAIN, handoff(AGENT, 'stop. The measure found no problem.'));
  ok('a Next that says stop closes the handoff', quiet(stop()));
  ticket(MAIN, handoff(AGENT, 'none, nothing is owed'));
  ok('a Next that says none closes the handoff', quiet(stop()));
  ticket(MAIN, handoff(AGENT, 'stop the daemon first, then run the suite'));
  ok('negative: a Next that merely starts with the word stop but names work is still noticed', noticed(stop()));

  ticket(MAIN, handoff(AGENT, 'land fw3'));
  let threw = false;
  try { closeHandoffs(d, AGENT, '  ', { run: comment }); } catch { threw = true; }
  ok('negative: a close without a reason is refused and the handoff is still noticed', threw && noticed(stop()));
  ok('negative: a close recorded for another agent does not close this one', (() => { comment(d, MAIN, `no successor owed [agent ${OTHER.slice(0, 8)}]: other`); return noticed(stop()); })());
  const closed = closeHandoffs(d, AGENT, 'measure found no problem', { run: comment });
  ok('an explicit close names the ticket and records the marker; the stop prints nothing', closed.join() === MAIN && quiet(stop()));
  ok('a second close finds nothing open', closeHandoffs(d, AGENT, 'again', { run: comment }).length === 0);

  ticket(MAIN, handoff(AGENT, 'land fw3'));
  ticket(MENTIONED, handoff(AGENT, 'land fw4'));
  roster(row({ tickets: [MAIN, MENTIONED] }));
  const both = stop();
  ok('a worker owes the ticket its task names, not the ticket its brief only mentions', noticed(both) && both.out.includes(MAIN) && !both.out.includes(MENTIONED));
  roster(row({ task: 'job 1 measure', tickets: [MAIN, MENTIONED] }));
  const all = stop();
  ok('control: a task label naming no ticket falls back to every ticket the brief cites', noticed(all) && all.out.includes(MAIN) && all.out.includes(MENTIONED));
} finally {
  cleanup();
}

done();
