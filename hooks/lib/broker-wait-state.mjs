// broker-wait-state.mjs — what the broker-wait gate remembers about one subagent (KIT-D115).
//
//   waitSlot(agent)        -> turn-state slot holding that agent's { waited: [jobId], submits: [digest] }
//   jobId(call)            -> the job a broker call names (a wait's `j-...` word, else its first positional word)
//   digest(command)        -> short hash identifying a submit command
//   neverStarted(error)    -> true when a failed command's output shows the shell or node never ran the script
//   hasJobId(text)         -> true when the output names a broker job id (`j-<time>-<rand>`)
//
// The PreToolUse gate records a call before it runs; the PostToolUseFailure release forgets a wait when the
// failure text says the script never started, and a submit when that or a missing job id shows no job was queued.

import { createHash } from 'node:crypto';

const DIGEST_CHARS = 12;
const NOT_STARTED = /Cannot find module|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|command not found|is not recognized as|The system cannot find the (?:path|file)/i;

const JOB_ID = /\bj-[0-9a-z]+-[0-9a-z]+\b/;

export const waitSlot = (agent) => `brokerwait-${String(agent).replace(/[^\w-]/g, '_')}`;
export const jobId = (call) => call.words.find((w) => /^j-/.test(w)) || call.sub;
export const digest = (text) => createHash('sha1').update(text).digest('hex').slice(0, DIGEST_CHARS);
export const neverStarted = (error) => NOT_STARTED.test(String(error || ''));
export const hasJobId = (text) => JOB_ID.test(String(text || ''));
