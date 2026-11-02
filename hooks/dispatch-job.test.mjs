// dispatch-job (KIT-T419): a dispatch names a job from the capability table and a model inside that job's row; an
// override, a definition default job and the ignore file pass.
// Run: node hooks/dispatch-job.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, finish, ignoreFile, makeRepo, run, transcript } from './dispatch-guard-harness.mjs';

const d = makeRepo();
const opus = transcript(d, 'opus-session', 'claude-opus-4-8');
const call = (input) => run(d, { jobless: true, subagent_type: 'general-purpose', ...input }, opus);
expect('blocks a dispatch naming no job', call({ model: 'sonnet', prompt: 'x' }).code, 2);
const noJob = call({ model: 'sonnet', prompt: 'x' }).err;
expect('the no-job block lists the job ids', /Job ids: .*targeted-change.*fix/.test(noJob) ? 1 : 0, 1);
expect('blocks an unknown job id', call({ model: 'sonnet', prompt: 'x [job: nonesuch]' }).code, 2);
expect('job + matching model passes', call({ model: 'sonnet', prompt: 'x [job: fix]' }).code, 0);
expect('the job may ride in the description label', call({ model: 'sonnet', description: '[sonnet] x [job: fix]', prompt: 'x' }).code, 0);
const higher = call({ model: 'opus', prompt: 'x [job: fix]' });
expect('job + higher model, no override, blocks', higher.code, 2);
expect('the model block names the table row', /table row: fix -> sonnet/.test(higher.err) ? 1 : 0, 1);
expect('[model-override: reason] lets the higher model through', call({ model: 'opus', prompt: 'x [job: fix] [model-override: needs the larger window]' }).code, 0);
expect('an empty override does not count', call({ model: 'opus', prompt: 'x [job: fix] [model-override: ]' }).code, 2);
expect('a model-less dispatch with a job passes (the table fills the family)', call({ prompt: 'x [job: fix]' }).code, 0);
expect('the targeted-change fallback family is allowed', call({ model: 'sonnet', prompt: 'x [job: targeted-change]' }).code, 0);
const ignored = ignoreFile(makeRepo(), 'dispatch-job');
expect('the ignore file lifts the job gate', run(ignored, { jobless: true, subagent_type: 'general-purpose', model: 'opus', prompt: 'x' }, opus).code, 0);

const agents = join(d, '.claude', 'agents');
mkdirSync(agents, { recursive: true });
writeFileSync(join(agents, 'jobbed.md'), ['---', 'name: jobbed', 'description: x', 'job: refactor', '---', 'body', ''].join('\n'));
expect('an agent definition default job passes', call({ subagent_type: 'jobbed', model: 'sonnet', prompt: 'x' }).code, 0);
expect('the definition job still checks the model', call({ subagent_type: 'jobbed', model: 'opus', prompt: 'x' }).code, 2);

finish();
