// rulings-checked (KIT-T938): a design or plan brief cites the inbox search while the inbox holds un-triaged notes.
// Run: node hooks/dispatch-rulings.test.mjs

import { expect, finish, ignoreFile, makeRepo, run, transcript } from './dispatch-guard-harness.mjs';
import { TRIAGE_LINE } from './lib/block-triage.mjs';
import { REAL_RULINGS, seedInbox } from './inbox-rulings-fixtures.mjs';

const repo = makeRepo();
const opus = transcript(repo, 'opus-session', 'claude-opus-4-8');
const clean = makeRepo();
const cleanTx = transcript(clean, 'opus-session', 'claude-opus-4-8');
seedInbox(repo, [...REAL_RULINGS, { file: '2026-11-09-1000-idea.md', text: 'form double-submits on slow network\n' }]);

const call = (dir, tx, prompt, extra = {}) => run(dir, { subagent_type: 'claude-kit:analyst', model: 'sonnet', prompt, ...extra }, tx);
const design = 'design the Song mode storage model for curve rows';
const blocked = call(repo, opus, design);
expect('a design brief to an analyst with un-triaged inbox notes is blocked', blocked.code, 2);
expect('the block names the check, lists the rulings and counts the rest', /rulings-checked/.test(blocked.err) && /2026-11-09-2136/.test(blocked.err) && /3 un-triaged inbox note\(s\), 2 of them quoting the maintainer/.test(blocked.err) && /\+1 other un-triaged/.test(blocked.err) ? 1 : 0, 1);
expect('the block carries the BLOCK TRIAGE footer and the exact tag form', blocked.err.includes(TRIAGE_LINE) && blocked.err.includes('[rulings-checked: <q inbox or q fts run, or inbox ids read>]') ? 1 : 0, 1);
expect('the tag with a search citation passes', call(repo, opus, `${design} [rulings-checked: q inbox read, 2026-11-09-2136 and 2139 bind this design]`).code, 0);
expect('the none-apply form passes', call(repo, opus, `${design} [rulings-checked: none apply: the inbox holds only bugs]`).code, 0);
expect('an empty tag does not count', call(repo, opus, `${design} [rulings-checked: ]`).code, 2);
const planned = run(repo, { subagent_type: 'general-purpose', model: 'opus', prompt: 'produce the master plan [job: plan] [model-override: fixture] [escalate: fixture]', jobless: true }, opus);
expect('a job plan dispatch is blocked whatever the agent type, by this check', planned.code === 2 && /rulings-checked/.test(planned.err) ? 1 : 0, 1);
expect('a job plan dispatch with the tag passes', run(repo, { subagent_type: 'general-purpose', model: 'opus', prompt: 'produce the master plan [job: plan] [rulings-checked: q fts scene metadata] [model-override: fixture] [escalate: fixture]', jobless: true }, opus).code, 0);
expect('a read-only researcher briefed with design words is asked too', call(repo, opus, 'research the architecture options', { subagent_type: 'claude-kit:researcher' }).code, 2);
expect('negative control: an implementer brief naming no design passes', call(repo, opus, 'fix the off-by-one in the exporter', { subagent_type: 'claude-kit:implementer' }).code, 0);
expect('negative control: an analyst brief with no design words passes', call(repo, opus, 'count the failing tests in the suite').code, 0);
expect('negative control: an empty inbox passes a design brief', call(clean, cleanTx, design).code, 0);
expect('the ignore file lifts rulings-checked', call(ignoreFile(repo, 'rulings-checked'), opus, design).code, 0);

finish();
