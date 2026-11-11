// handback reconciler (KIT-T822, KIT-D132): every way a worker ends leaves durable state, and the reconciler lists what is
// open from it as a NOTICE. The Stop hook and the UserPromptSubmit hook print it once per distinct set per session and
// never block or order a dispatch; an ack or a reopen clears it.
// Run: node hooks/handback.test.mjs

import { appendFileSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { resubmitJob } from '../scripts/broker/submissions.mjs';

const RUN = `${process.pid}-${Date.now()}`;
const { ok, done } = reporter('handback');
const OLD = 'a1b2c3d4e5f6a7b8c';
const TICKET = 'KIT-T900';
const JOB = 'j-mvx000-aaaaaa';
const MINUTE_MS = 60000;
const NOTICE = /OPEN, awaiting a bill of work/;
const at = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const noticed = (r) => r.code === 0 && NOTICE.test(r.out);
const silent = (r) => r.code === 0 && !NOTICE.test(r.out);

try {
  const d = adopted(false);
  const broker = join(d, 'target', 'broker');
  const cfg = { targetDir: join(d, 'target') };
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  const ticket = (status, notes = '## Notes\n') => writeFileSync(join(d, '.ai', 'tickets', `${TICKET}-thing.md`), `---\nid: ${TICKET}\nstatus: ${status}\n---\n\n${notes}`);
  const reset = () => {
    for (const f of ['finished.log', 'finished.ack', 'submissions.jsonl']) writeFileSync(join(broker, f), '');
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

  const resumableRow = (sid, extra = {}) => {
    const transcript = join(d, 'sessions', sid, 'tasks', `${OLD}.output`);
    mkdirSync(dirname(transcript), { recursive: true });
    writeFileSync(transcript, '');
    return row({ outputFile: transcript, ...extra });
  };
  const stopResumable = (extra) => {
    const sid = `s${RUN}-${n++}`;
    roster(resumableRow(sid, extra));
    return stop(sid);
  };

  ticket('doing');
  reset(); roster(row()); ledger(); finishedLine(30); result();
  const ready = stopResumable();
  ok('normal hand-back: a Stop with a finished job nobody picked up exits 0 and prints RESULT READY as a notice', noticed(ready) && ready.out.includes(`RESULT READY: ${JOB} landed (landed 01234567) for ${TICKET}`) && ready.out.includes(OLD));
  ok('the notice orders nothing: no BLOCKED, no dispatch order, no "no maintainer input needed"', !/BLOCKED|DISPATCH NOW|no maintainer input/i.test(ready.out) && /Relay this to the maintainer/.test(ready.out));
  const sid = `same-${RUN}`;
  const firstPrompt = prompt(sid);
  ok('the prompt hook prints the same open set once per session as a notice, and never again while unchanged', noticed(firstPrompt) && firstPrompt.out.includes(`RESULT READY: ${JOB}`) && silent(prompt(sid)));
  ok('orient lists the same item under OPEN, awaiting a bill of work', /OPEN, awaiting a bill of work: ended workers[\s\S]*RESULT READY/.test(hook('orient.mjs', {}, d).out));

  ok('negative: reopening the agent with a SendMessage acknowledges its job and clears the item', reopen().code === 0 && silent(stop()));
  rmSync(join(d, '.ai', 'reopened.jsonl'), { force: true });

  reset(); ledger(); finishedLine(30); result();
  ok('control: without the reopen the same state is still listed', noticed(stop()));
  appendFileSync(join(broker, 'finished.ack'), `${at(0)} ${JOB} orchestrator\n`);
  ok('negative: an ack line clears it', silent(stop()));

  reset(); ledger(); finishedLine(120); result();
  ok('negative: a result that finished before the agent retired was seen by it', silent(stop()));
  roster(row({ status: 'killed' }));
  ok('crash: the same early result is unread when the agent was killed, and is listed', noticed(stop()));
  roster(row({ status: 'error' }));
  ok('usage limit: an errored agent with a finished job is listed the same way', noticed(stop()));

  roster(row()); reset(); ledger(); finishedLine(30);
  const purged = stop();
  ok('purged result file: finished.log still carries the verdict, and the notice says the file is gone', noticed(purged) && /result file purged/.test(purged.out) && purged.out.includes('landed'));

  reset(); ledger();
  writeFileSync(join(broker, 'queue', `${JOB}.json`), '{}');
  ok('negative: a job still queued is waiting, not a failure', silent(stop()));
  reset(); ledger({ submittedAt: at(5000) });
  ok('negative: a job submitted seconds ago is not lost yet', silent(stop()));

  reset(); ledger(); keepCopy();
  const lost = stop();
  ok('crash mid-submit: ledger row, no queue file, no result, kept copy -> JOB LOST noted with the resubmit command as information', noticed(lost) && /JOB LOST/.test(lost.out) && lost.out.includes('resubmit.mjs') && /If the maintainer signs it/.test(lost.out));
  ok('the resubmit recovers it: the kept job is queued again under a new id and the lost id is not re-listed', (() => {
    const queued = resubmitJob(cfg, JOB);
    appendFileSync(join(broker, 'finished.ack'), `${at(0)} ${JOB} resubmitted-as-${queued.id}\n`);
    return queued && queued.resubmitOf === JOB && silent(stop());
  })());

  reset(); ledger();
  const fresh = stop();
  ok('lost job with no kept copy but a ticket is listed with the ticket to rebuild from', noticed(fresh) && /JOB LOST/.test(fresh.out) && /a fresh worker citing KIT-T900/.test(fresh.out));

  reset(); ledger({ ticket: null });
  roster(row({ tickets: [] }));
  const sidStuck = `un-${RUN}`;
  const stuck = stop(sidStuck);
  ok('negative control: a lost job with no copy and no ticket is listed as unrecoverable', noticed(stuck) && /UNRECOVERABLE/.test(stuck.out));
  ok('and listed once: the same finding is not printed again in that session', silent(stop(sidStuck)));

  reset(); roster(row({ status: 'killed' }));
  const dead = stop();
  ok('killed session: an agent that died with no Handoff and no job is listed, and the notice says the ticket may be stale', noticed(dead) && /AGENT KILLED/.test(dead.out) && /superseded or stale/.test(dead.out));
  ok('negative: a dispatch citing the ticket since clears it', (roster(row({ status: 'killed' }), { ts: at(MINUTE_MS), id: 'b2c3d4e5f6a7b8c9d', scope: 'implementer', model: 'x', status: 'in-flight', task: 'redo', tickets: [TICKET] }), silent(stop())));

  roster(row({ status: 'killed' })); ticket('review');
  ok('negative: a ticket in review has nothing open', silent(stop()));
  ticket('doing');

  roster(row());
  ok('negative control: a worker that ended normally with no Handoff and no job leaves nothing open', silent(stop()));
  ticket('doing', `## Notes\n\n### Handoff ${OLD}\n- Jobs: none\n- State: patch drafted\n- Next: submit it\n- Files: a.mjs\n`);
  ok('a Handoff on an open ticket with no job is listed as RETIRED WITH HANDOFF', /RETIRED WITH HANDOFF/.test(stop().out));
  reopen();
  ok('KIT-T912: a SendMessage that names no ticket still takes over the tickets the agent was dispatched for', silent(stop()));
  rmSync(join(d, '.ai', 'reopened.jsonl'), { force: true });
  ok('KIT-T912 control: without the resume the same Handoff is listed again', /RETIRED WITH HANDOFF/.test(stop().out));
  reset(); ledger({ agent: null, submittedAt: at(5 * MINUTE_MS) }); writeFileSync(join(broker, 'queue', `${JOB}.json`), '{}');
  ok('KIT-T912: a live broker job for the ticket means its work is in progress: no retirement is listed', silent(stop()));
  reset();
  ok('KIT-T912 control: with the job gone the Handoff is listed', /RETIRED WITH HANDOFF/.test(stop().out));

  const handoffBlock = (label) => `\n### Handoff ${OLD} (${label})\n- Jobs: none\n- State: patch drafted\n- Next: submit it\n- Files: a.mjs\n`;
  const withHandoffs = (count) => ticket('doing', `## Notes\n${Array.from({ length: count }, (_, i) => handoffBlock(i + 1)).join('')}`);
  withHandoffs(2);
  reopen();
  const retiredAgain = { ts: at(-MINUTE_MS) };
  roster(row(retiredAgain));
  ok('KIT-T912: the resumed run retiring again leaves the Handoff the resume took over unlisted', silent(stop()));
  withHandoffs(3);
  ok('KIT-T912 control: a newer Handoff block written by the resumed run is listed', /RETIRED WITH HANDOFF/.test(stop().out));
  rmSync(join(d, '.ai', 'reopened.jsonl'), { force: true });
  roster(row());
  ticket('doing', `## Notes\n\n### Handoff ${OLD}\n- Jobs: none\n- State: patch drafted\n- Next: submit it\n- Files: a.mjs\n`);

  reset(); ledger(); finishedLine(30); result();
  ok('a hand-back with a Handoff AND an unread result is listed as the result, not a retirement', (() => { const r = stop(); return noticed(r) && r.out.includes('RESULT READY') && !r.out.includes('RETIRED WITH HANDOFF'); })());

  ticket('doing', `## Notes\n\n### Handoff ${OLD}\n- Jobs: none\n- State: patch drafted\n- Next: submit it\n- Files: a.mjs\n`);
  reset(); roster(row({ scope: 'claude-kit:patch-worker' }));
  ok('a patch-worker (it owns its ticket through the broker) with a Handoff is listed', /RETIRED WITH HANDOFF/.test(stop().out));
  const reader = { ts: at(MINUTE_MS), id: 'c3d4e5f6a7b8c9d0e', scope: 'claude-kit:researcher', model: 'x', status: 'done', task: 'read', tickets: [TICKET] };
  roster(row({ scope: 'claude-kit:patch-worker' }), reader);
  ok('control: a read-only researcher citing the ticket since is no successor, the item stays listed', noticed(stop()));
  roster(row({ scope: 'claude-kit:patch-worker' }), { ...reader, scope: 'claude-kit:patch-worker', id: 'd4e5f6a7b8c9d0e1f', status: 'in-flight' });
  ok('negative: a patch-worker dispatched since is a successor and clears it', silent(stop()));

  ticket('doing');
  reset(); roster(row({ scope: 'claude-kit:patch-worker' }));
  appendFileSync(join(broker, 'finished.log'), `${at(30 * MINUTE_MS)} ${JOB} landed agent=- ticket=${TICKET} landed=0123456789abcdef\n`);
  const untagged = stopResumable({ scope: 'claude-kit:patch-worker' });
  ok('a job finished before the broker tagged agents is attributed to the ticket\'s latest worker: RESULT READY, agent named', noticed(untagged) && untagged.out.includes(`RESULT READY: ${JOB}`) && untagged.out.includes(OLD));

  reset(); roster(row({ scope: 'claude-kit:patch-worker' })); ledger({ agent: null }); finishedLine(30, 'landed', '-');
  ok('KIT-T909: a finished job the ledger holds with no agent was a main-thread submit and is listed against no worker', silent(stop()));
  reset(); ledger(); finishedLine(30, 'landed', '-');
  const bySubmitter = stopResumable({ scope: 'claude-kit:patch-worker' });
  ok('KIT-T909 control: a finished line with no agent is attributed to the agent the ledger names', noticed(bySubmitter) && bySubmitter.out.includes(`RESULT READY: ${JOB}`) && bySubmitter.out.includes(OLD));
  reset(); roster(row({ scope: 'claude-kit:patch-worker' })); ledger({ agent: 'zzzzzzzzzzzzzzzzz' }); finishedLine(30, 'landed', '-');
  ok('KIT-T909 control: a job the ledger gives to another agent is not this worker\'s', silent(stop()));

  reset(); roster(row()); ledger(); finishedLine(30); result();
  const stranded = stop();
  ok('an agent from an earlier session is not offered for reopen: a landed result says to verify the sha and ack it', noticed(stranded) && /not resumable here\. If the maintainer signs it: verify 01234567 is on main/.test(stranded.out) && !/SendMessage a1b2/.test(stranded.out));
  reset(); roster(row()); ledger(); finishedLine(30, 'passed'); result();
  const unfinished = stop();
  ok('a non-resumable agent whose job only passed (work remains) lists a fresh worker briefed from its Handoff', noticed(unfinished) && /not resumable here\. If the maintainer signs it: a fresh worker citing KIT-T900/.test(unfinished.out));
  roster(resumableRow(`gone-${RUN}`));
  ok('control: a transcript from another session is still not reachable from this one', /a fresh worker citing/.test(stop().out));

  const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-C', d, ...args], { encoding: 'utf8' }).trim();
  git('commit', '-q', '--allow-empty', '-m', 'landed work');
  const sha = git('rev-parse', 'HEAD');
  const landedLine = () => appendFileSync(join(broker, 'finished.log'), `${at(30 * MINUTE_MS)} ${JOB} landed agent=${OLD} ticket=${TICKET} landed=${sha}\n`);
  reset(); roster(row()); ledger(); landedLine(); result();
  ticket('doing', `## Notes\n\nlanded ${sha.slice(0, 7)}\n`);
  ok('a landed sha that is on main and recorded in the ticket is acknowledged by the reconciler: nothing is listed', silent(stop()) && readFileSync(join(broker, 'finished.ack'), 'utf8').includes(JOB));
  reset(); ledger(); landedLine(); result();
  ticket('doing', '## Notes\n\nnothing recorded\n');
  ok('control: on main but not recorded in the ticket is listed to verify by hand', /verify .* is on main/.test(stop().out));
  reset(); ledger(); appendFileSync(join(broker, 'finished.log'), `${at(30 * MINUTE_MS)} ${JOB} landed agent=${OLD} ticket=${TICKET} landed=${'ab'.repeat(20)}\n`); result();
  ticket('doing', `## Notes\n\nlanded ${'ab'.repeat(20).slice(0, 7)}\n`);
  ok('control: recorded in the ticket but not on main is listed to verify by hand', /verify .* is on main/.test(stop().out));
  ticket('doing');

  ticket('doing');
  roster(row({ scope: 'Explore' }));
  ok('negative: a read-only agent with an unread result leaves nothing open', silent(stop()));
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), `successor:\n  - "${TICKET}"\n`);
  roster(row());
  ok('.claude-kit-ignore.yaml glob over the ticket id excludes it', silent(stop()));
  rmSync(join(d, '.claude-kit-ignore.yaml'), { force: true });

  // KIT-T1011: a worker whose transcript is being written is running, whatever its roster row says.
  const transcriptAged = (ageMin) => {
    const file = join(d, 'sessions', `live-${n++}`, `${OLD}.output`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '{"type":"assistant"}\n');
    const stamp = (Date.now() - ageMin * MINUTE_MS) / 1000;
    utimesSync(file, stamp, stamp);
    return file;
  };
  reset();
  ticket('doing');
  roster(row({ status: 'stale', outputFile: transcriptAged(1) }));
  ok('KIT-T1011: a row marked stale whose transcript was written a minute ago is a running worker: nothing is listed', silent(stop()));
  roster(row({ status: 'stale', outputFile: transcriptAged(90) }));
  ok('KIT-T1011 control: the same stale row with an idle transcript is still listed', /AGENT STALE/.test(stop().out));
  roster(row({ status: 'stale' }));
  ok('KIT-T1011 control: a stale row with no transcript at all is still listed', /AGENT STALE/.test(stop().out));

  const OTHER_TICKET = 'KIT-T901';
  writeFileSync(join(d, '.ai', 'tickets', `${OTHER_TICKET}-other.md`), `---\nid: ${OTHER_TICKET}\nstatus: doing\n---\n\n## Notes\n`);
  ticket('doing', `## Notes\n\nworked by ${OLD}\n`);
  roster(row({ status: 'killed', tickets: [TICKET, OTHER_TICKET] }));
  const attributed = stop().out;
  ok('KIT-T1011: of several tickets a brief cites, only the one that names the agent is listed', attributed.includes(TICKET) && !attributed.includes(OTHER_TICKET));
  ticket('doing');
  const unattributed = stop().out;
  ok('KIT-T1011 control: when no cited ticket names the agent, every cited ticket is listed', unattributed.includes(TICKET) && unattributed.includes(OTHER_TICKET));
} finally {
  cleanup();
}

done();
