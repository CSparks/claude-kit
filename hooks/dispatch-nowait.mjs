// dispatch-nowait — the no-wait rule every patch-worker brief carries (KIT-D115). activity-tag appends it
// to the prompt of a patch-worker dispatch, once.
//
//   NO_WAIT_RULE                    -> the rule text, led by NO_WAIT_MARK
//   isPatchWorker(input)            -> is the dispatch a patch-worker
//   withNoWaitRule(input)           -> input with the rule appended to its prompt, or null when it needs none

export const NO_WAIT_MARK = 'NO-WAIT RULE (KIT-D115)';
const PATCH_WORKER = /(?:^|:)patch-worker$/i;
export const NO_WAIT_RULE = [
  `${NO_WAIT_MARK}:`,
  '- Submit your jobs, then wait AT MOST ONCE: `wait.mjs <id> --root <tree> --timeout 280` in the foreground. The hook adds the timeout.',
  '- Never poll, loop, tail or sleep on the broker; never background a wait or any broker or cargo command; never wait twice on one job; never resubmit a job to read its status.',
  '- Past the one wait: write a Handoff block in the ticket Notes (Jobs:, State:, Next:, Files:), end with nothing running, and report the job ids. The orchestrator resumes you from the broker finished-job line.',
].join('\n');

export const isPatchWorker = (input) => PATCH_WORKER.test(String(input?.subagent_type || input?.agent_type || '').trim());

export function withNoWaitRule(input) {
  const prompt = typeof input?.prompt === 'string' ? input.prompt : typeof input?.message === 'string' ? input.message : '';
  if (!isPatchWorker(input) || !prompt || prompt.includes(NO_WAIT_MARK)) return null;
  const key = typeof input.prompt === 'string' ? 'prompt' : 'message';
  return { ...input, [key]: `${prompt}\n\n${NO_WAIT_RULE}` };
}
