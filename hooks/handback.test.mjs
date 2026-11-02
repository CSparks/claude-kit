// handback reconciler (KIT-T822): every way a worker ends leaves durable state, and the reconciler names the recovery
// step from it with no maintainer input; the Stop gate and the UserPromptSubmit hook surface it, an ack or a reopen
// clears it, and a case it cannot rebuild surfaces once.
// Run: node hooks/handback.test.mjs

import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { resubmitJob } from '../scripts/broker/submissions.mjs';

const RUN = `${process.pid}-${Date.now()}`;
const { ok, done } = reporter('handback');
const OLD = 'a1b2c3d4e5f6a7b8c';
const TICKET = 'KIT-T900';
const JOB = 'j-mvx000-aaaaaa';
const MINUTE_MS = 60000;
const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();

try {
  const d = adopted(false);
  const broker = join(d, 'target', 'broker');
  const cfg = { targetDir: join(d, 'target') };
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  const ticket = (status, notes = '## Notes\n') => writeFileSync(join(d, '.ai', 'tickets', `${TICKET}-thing.md`), `---\nid: ${TICKET}\nstatus: ${status}\n---\n\n${notes}`);
  const reset = () => {
    for (const f of ['finished.log', 'finished.ack', 'submissions.jsonl', 'resume-attempts.jsonl']) writeFileSync(join(broker, f), '');
    for (const sub of ['queue', 'results', 'submitted']) rmSync(join(broker, sub, `${JOB}.json`), { force: true });
  };
  mkdirSync(join(broker, 'queue'), { recursive: true });
  mkdirSync(join(broker, 'results'), { recursive: true });
  mkdirSync(join(broker, 'submitted'), { recursive: true });
  const roster = (...rows) => writeFileSync(join(d, '.ai', 'agents.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const row = (extra = {}) => ({ ts: at(60 * MINUTE_MS), id: OLD, scope: 'implementer', model: 'claude-sonnet-5-5', status: 'done', task: 'work', tickets: [TICKET], ...extra });
  const ledger = (extra = {}) => appendFileSync(join(broker, 'submissions.jsonl'), `${JSON.stringify({ id: JOB, agent: OLD, session: 's', ticket: TICKET, repo: 'r', submittedAt: at(90 * MINUTE_MS), ...extra })}\n`);
  const finishedLine = (agoMin, verdict = 'landed', agent = OLD) => appendFileSync(join(broker, 'finished.log'), `${at(agoMin * MINUTE_MS)} ${JOB} ${verdict} agent=${agent} ticket=${TICKET}${verdict === 'landed' ? ' landed=0123456789abcdef' : ''}\n`);
  const keepCopy = () => writeFileSync(join(broker, 'submitted', `${JOB}.json`), JSON.stringify({ id: JOB, repo: 'r', ticket: TICKET, agent: OLD, commands: [] }));
  const result = () => writeFileSync(join(broker, 'results', `${JOB}.json`), JSON.stringify({ id: JOB, status: 'landed' }));
  let n = 0;
  const stop = (sid) => hook('successor-gate.mjs', { hook_event_name: 'Stop', session_id: sid || `s${RUN}-${n++}` }, d);
  const prompt = (sid) => hook('handback-directive.mjs', { hook_event_name: 'UserPromptSubmit', session_id: sid || `p${RUN}-${n++}`, prompt: 'go' }, d);
  const reopen = () => hook('resume-check.mjs', { hook_event_name: 'PreToolUse', tool_name: 'SendMessage', tool_input: { to: OLD, message: 'continue' } }, d);

  ticket('doing');
  reset(); roster(row()); ledger(); finishedLine(30); result();
  const ready = stop();
  ok('normal hand-back: a finished job nobody picked up blocks with RESULT READY and the agent to reopen', ready.code === 2 && ready.out.includes(`RESULT READY: ${JOB} landed (landed 01234567) for ${TICKET}, reopen ${OLD}`) && /NEXT STEP reopen/.test(ready.out));
  ok('the same prompt surfaces the step as context, once per set', prompt(`same-${RUN}`).out.includes(`RESULT READY: ${JOB}`) && prompt(`same-${RUN}`).out.trim() === '');
  ok('orient lists the same step under ENDED WORKERS', /ENDED WORKERS, OPEN WORK[\s\S]*RESULT READY/.test(hook('orient.mjs', {}, d).out));
  const failed = stop();
  ok('surfaced earlier and still not done: the gate names the failing step and the count', failed.code === 2 && /FAILED STEP reopen: surfaced \d+x/.test(failed.out));

  ok('negative: reopening the agent with a SendMessage acknowledges its job and clears the step', reopen().code === 0 && stop().code === 0);

  reset(); ledger(); finishedLine(30); result();
  ok('control: without the reopen the same state still blocks', stop().code === 2);
  appendFileSync(join(broker, 'finished.ack'), `${at(0)} ${JOB} orchestrator\n`);
  ok('negative: an ack line clears it', stop().code === 0);

  reset(); ledger(); finishedLine(120); result();
  ok('negative: a result that finished before the agent retired was seen by it', stop().code === 0);
  roster(row({ status: 'killed' }));
  ok('crash: the same early result is unread when the agent was killed, and blocks', stop().code === 2);
  roster(row({ status: 'error' }));
  ok('usage limit: an errored agent with a finished job blocks the same way', stop().code === 2);

  roster(row()); reset(); ledger(); finishedLine(30);
  const purged = stop();
  ok('purged result file: finished.log still carries the verdict, the step is named, and it says the file is gone', purged.code === 2 && /result file purged/.test(purged.out) && purged.out.includes('landed'));

  reset(); ledger();
  writeFileSync(join(broker, 'queue', `${JOB}.json`), '{}');
  ok('negative: a job still queued is waiting, not a failure', stop().code === 0);
  reset(); ledger({ submittedAt: at(5000) });
  ok('negative: a job submitted seconds ago is not lost yet', stop().code === 0);

  reset(); ledger(); keepCopy();
  const lost = stop();
  ok('crash mid-submit: ledger row, no queue file, no result, kept copy -> JOB LOST with the resubmit command', lost.code === 2 && /JOB LOST/.test(lost.out) && lost.out.includes('resubmit.mjs'));
  ok('the resubmit recovers it: the kept job is queued again under a new id and the lost id is not re-listed', (() => {
    const queued = resubmitJob(cfg, JOB);
    appendFileSync(join(broker, 'finished.ack'), `${at(0)} ${JOB} resubmitted-as-${queued.id}\n`);
    return queued && queued.resubmitOf === JOB && stop().code === 0;
  })());

  reset(); ledger();
  const fresh = stop();
  ok('lost job with no kept copy but a ticket -> a fresh worker briefed from the ticket and git', fresh.code === 2 && /JOB LOST/.test(fresh.out) && /fresh worker citing KIT-T900/.test(fresh.out));

  reset(); ledger({ ticket: null });
  roster(row({ tickets: [] }));
  const sid = `un-${RUN}`;
  const stuck = stop(sid);
  ok('negative control: a lost job with no copy and no ticket is unrecoverable and surfaces', stuck.code === 2 && /CANNOT RECOVER/.test(stuck.out));
  ok('and surfaces once: the same finding does not block again', stop(sid).code === 0);

  reset(); roster(row({ status: 'killed' }));
  const dead = stop();
  ok('killed session: an agent that died with no Handoff and no job leaves the ticket to a fresh worker', dead.code === 2 && /AGENT KILLED/.test(dead.out) && dead.out.includes('git log --grep=KIT-T900'));
  ok('negative: a dispatch citing the ticket since clears it', (roster(row({ status: 'killed' }), { ts: at(MINUTE_MS), id: 'b2c3d4e5f6a7b8c9d', scope: 'implementer', model: 'x', status: 'in-flight', task: 'redo', tickets: [TICKET] }), stop().code === 0));

  roster(row({ status: 'killed' })); ticket('review');
  ok('negative: a ticket in review needs no recovery', stop().code === 0);
  ticket('doing');

  roster(row());
  ok('negative control: a worker that ended normally with no Handoff and no job leaves nothing open', stop().code === 0);
  ticket('doing', `## Notes\n\n### Handoff ${OLD}\n- Jobs: none\n- State: patch drafted\n- Next: submit it\n- Files: a.mjs\n`);
  ok('a Handoff on an open ticket with no job still asks for a successor', /RETIRED WITH HANDOFF/.test(stop().out));

  reset(); ledger(); finishedLine(30); result();
  ok('a hand-back with a Handoff AND an unread result is a reopen, not a retirement', (() => { const r = stop(); return r.code === 2 && r.out.includes('RESULT READY') && !r.out.includes('RETIRED WITH HANDOFF'); })());

  ticket('doing');
  roster(row({ scope: 'Explore' }));
  ok('negative: a read-only agent with an unread result creates no obligation', stop().code === 0);
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), `successor:\n  - "${TICKET}"\n`);
  roster(row());
  ok('.claude-kit-ignore.yaml glob over the ticket id excludes it', stop().code === 0);
} finally {
  cleanup();
}

done();
