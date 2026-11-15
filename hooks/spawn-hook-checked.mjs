// A hook script run the way the gate suites run it, with a hook process that did not run told apart from a gate that let a call
// pass (KIT-T1271): a spawn error or a kill gives no exit status, which a suite would read as "not blocked".
//
//   spawnHookChecked(script, options) -> the spawnSync result; the call is retried once when the process did not run, and
//     throws when it still did not, so the suite fails loudly instead of misreporting the gate

import { spawnSync } from 'node:child_process';

const didNotRun = (result) => Boolean(result.error) || result.status === null;

export function spawnHookChecked(script, options) {
  const once = () => spawnSync(process.execPath, [script], options);
  const first = once();
  const result = didNotRun(first) ? once() : first;
  if (didNotRun(result)) throw new Error(`hook ${script} did not run: ${result.error ? result.error.message : `signal ${result.signal}`}`);
  return result;
}
