// reopened (KIT-T837): a SendMessage that resumes the retired worker and names its ticket takes the handoff over; a message
// to another agent or about another ticket does not; a reopened worker that stays silent comes back as a failed step.
// Run: node hooks/reopened.test.mjs

import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';

const RUN = `${process.pid}-${Date.now()}`;
const { ok, done } = reporter('reopened');
const AGENT = 'a1b2c3d4e5f6a7b8c';
const OTHER = 'b2c3d4e5f6a7b8c9d';
const TICKET = 'KIT-T900';
const ELSE_TICKET = 'KIT-T901';
const MIN_MS = 60000;
const HOUR_MS = 60 * MIN_MS;

const handoff = (id) => `## Notes\n\n### Handoff ${id}\n- Jobs: j-1-a (passed)\n- State: patch landed\n- Next: run the suite\n- Files: hooks/x.mjs:10\n`;
const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();

try {
  const d = adopted(false);
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  const output = join(d, 'agent.output');
  writeFileSync(output, 'transcript\n');
  const touch = (msAgo) => utimesSync(output, (Date.now() - msAgo) / 1000, (Date.now() - msAgo) / 1000);
  writeFileSync(join(d, '.ai', 'tickets', `${TICKET}-thing.md`), `---\nid: ${TICKET}\nstatus: doing\n---\n\n${handoff(AGENT)}`);
  const retired = (extra = {}) => ({ ts: at(HOUR_MS), id: AGENT, scope: 'implementer', model: 'claude-sonnet-5-5', status: 'done', task: `${TICKET} fix`, tickets: [TICKET], outputFile: output, ...extra });
  const roster = (...rows) => writeFileSync(join(d, '.ai', 'agents.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const reopenRows = (...rows) => writeFileSync(join(d, '.ai', 'reopened.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const resume = (to, message) => hook('resume-check.mjs', { hook_event_name: 'PreToolUse', tool_name: 'SendMessage', tool_input: { to, message } }, d);
  let n = 0;
  const stop = () => hook('successor-gate.mjs', { hook_event_name: 'Stop', session_id: `s${RUN}-${n++}`, cwd: d }, d);
  const reset = () => { reopenRows(); roster(retired()); touch(HOUR_MS); };

  reset();
  ok('control: a retired worker with a Handoff and no resume blocks', stop().code === 2);

  resume(OTHER, `finish ${TICKET}`);
  ok('negative: a SendMessage to a different agent does not take the handoff over', stop().code === 2);
  resume(AGENT, 'please continue, thanks');
  ok('negative: a SendMessage that names no ticket does not take it over', stop().code === 2);
  resume(AGENT, `please look at ${ELSE_TICKET}`);
  ok('negative: a SendMessage naming a different ticket does not take it over', stop().code === 2);

  resume(AGENT, `finish the owed work on ${TICKET}`);
  ok('a SendMessage resuming the agent and naming the ticket takes the handoff over', stop().code === 0);

  reopenRows({ ts: at(40 * MIN_MS), agent: AGENT, tickets: [TICKET] });
  const silent = stop();
  ok('an agent that never reports after the resume comes back as a failed step after the timeout', silent.code === 2 && /REOPENED, SILENT/.test(silent.out) && silent.out.includes(AGENT));

  touch(MIN_MS);
  ok('control: a reopened agent whose output is still growing is not silent', stop().code === 0);

  touch(HOUR_MS);
  reopenRows({ ts: at(40 * MIN_MS), agent: AGENT, tickets: [TICKET] });
  roster(retired({ ts: at(5 * MIN_MS) }));
  ok('after the resumed agent retires again, the normal handoff rule applies', stop().code === 2 && !/REOPENED/.test(stop().out));
} finally {
  cleanup();
}

done();
