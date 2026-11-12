// capability-table-stale exemption and early warning (KIT-T1089): a stale table blocks every dispatch except the
// [model-refresh: <date>] research reassessment; a table two days from the block warns once per session.
// Run: node hooks/dispatch-guard-stale.test.mjs

import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixtureKit, isoDaysAgo } from './test-harness.mjs';
import { expect, finish, makeRepo, runRaw, transcript } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'dg-stale-state-'));
const repo = makeRepo();
const opus = transcript(repo, 'opus-session', 'claude-opus-4-8');
const STALE_DAYS = 30;
const WARN_DAYS = 5;
const REFRESH_DAYS = 7;
const NOTE_DATE = '2026-11-11';
const NOTE = `research/models-capability-${NOTE_DATE}.md`;
const SESSION_TAGS = '[model-override: fixture] [escalate: fixture] [read-only: fixture]';

// A block raised by any gate other than the stale one reports as 'blocked-by-other-gate'.
const send = (prompt, sessionId = '') => {
  const r = runRaw(repo, JSON.stringify({ tool_name: 'Agent', session_id: sessionId || undefined, transcript_path: opus, tool_input: { subagent_type: 'general-purpose', model: 'sonnet', prompt: `${prompt} ${SESSION_TAGS}` } }));
  return { ...r, code: r.code === 2 && !/capability table is stale/.test(r.err) ? 'blocked-by-other-gate' : r.code };
};
const ordinary = () => send('fix the thing [job: fix]');
const refresh = (extra) => send(`reassess models [job: research] [model-refresh: ${NOTE_DATE}] write ${NOTE} ${extra}`);
const withKit = (days) => { process.env.DG_LADDER_ROOT = fixtureKit(isoDaysAgo(days)); };

withKit(STALE_DAYS);
expect('stale row + ordinary dispatch blocks', ordinary().code, 2);
expect('stale row + exempt research dispatch passes', refresh('[paths: research/models-capability-2026-11-11.md, .ai/config.yml, .ai/decisions/KIT-D165.md]').code, 0);
expect('exempt dispatch may declare the lineup record the refresh writes', refresh('[paths: .ai/model-lineup.json]').code, 0);
expect('exempt tag with a path outside the refresh outputs blocks', refresh('[paths: research/x.md, hooks/dispatch-guard.mjs]').code, 2);
expect('exempt tag with a path escaping research/ blocks', refresh('[paths: research/../hooks/x.mjs]').code, 2);
expect('exempt tag with no [paths:] blocks', refresh('').code, 2);
expect('exempt tag with [paths: *] blocks', refresh('[paths: *]').code, 2);
expect('the tag on a non-research job blocks', send(`fix [job: fix] [model-refresh: ${NOTE_DATE}] ${NOTE} [paths: research/x.md]`).code, 2);
expect('a tag whose date differs from the named file blocks', send(`reassess [job: research] [model-refresh: 2026-11-12] ${NOTE} [paths: research/x.md]`).code, 2);
expect('a brief naming the file without the tag blocks', send(`reassess [job: research] ${NOTE} [paths: research/x.md]`).code, 2);
expect('the stale block names the exemption tag', /\[model-refresh:/.test(ordinary().err) ? 1 : 0, 1);

withKit(WARN_DAYS);
const first = send('fix [job: fix]', 'session-a');
expect('a table five days old passes', first.code, 0);
expect('the five-day pass prints the refresh reminder', /capability table: WARNING/.test(first.err) && /model-refresh/.test(first.err) ? 1 : 0, 1);
const second = send('fix [job: fix]', 'session-a');
expect('the reminder prints once per session', second.code === 0 && !/capability table: WARNING/.test(second.err) ? 1 : 0, 1);
expect('a new session hears the reminder again', /capability table: WARNING/.test(send('fix [job: fix]', 'session-b').err) ? 1 : 0, 1);

withKit(REFRESH_DAYS);
expect('a table at the refresh period still passes', send('fix [job: fix]', 'session-d').code, 0);
withKit(REFRESH_DAYS + 1);
expect('a table one day past the refresh period blocks', send('fix [job: fix]', 'session-e').code, 2);

withKit(0);
expect('a fresh table prints no reminder', /capability table: WARNING/.test(send('fix [job: fix]', 'session-c').err) ? 1 : 0, 0);

finish();
