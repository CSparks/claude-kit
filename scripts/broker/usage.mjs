// usage.mjs — broker.mjs argument validation (KIT-T501). Unknown commands or flags and `--help`
// print usage and exit before anything is created or started.
//
// `usageProblem(flags)` → null | { text, code }: code 0 for help, 2 for a bad argument.

const COMMANDS = new Set(['pause', 'resume', 'cancel', 'status', 'stop', 'stats', 'blockers', 'clean', 'restore']);
const FLAGS = new Set(['_', 'root', 'log', 'once', 'poll', 'idle-exit', 'spawned-by', 'now', 'help', 'since', 'json', 'lane', 'pycache', 'debris', 'running', 'top']);

export const USAGE = [
  'usage: broker.mjs [--root <checkout>] [command] [options]',
  '  (no command)   run the daemon; options: --lane <submodule repo> (a submodule repo: its own queue; default the root lane) --once --poll <ms> --idle-exit <min> --log <file|auto>',
  '  status         show the daemon, queue and suite state',
  '  stats [--since 24h|7d|<ISO>] [--json]   queue wait, phase minutes, failure rates, batches, fairness, stall kills, ST-T904 share',
  '  blockers [--since 24h|7d|<ISO>] [--top N] [--json]   where wall time goes, waste first, ranked against the window before, with trend (KIT-D121)',
  '  pause|resume   stop or resume starting jobs',
  '  cancel <id> [--running]   withdraw a queued job; --running kills the running command tree; the job ends cancelled',
  '  clean <path...>|--pycache   remove untracked leftovers from the checkout (a stray __pycache__); tracked files are refused',
  '  restore <path...>|--debris   put Cargo.lock debris a killed job left, and files a broker job wrote, back from HEAD (hand edits are refused)',
  '  stop [--now]   stop the daemon after its current job; refuses while a job is queued or running unless --now',
].join('\n');

export function usageProblem(flags) {
  if (flags.help) return { text: USAGE, code: 0 };
  const bad = Object.keys(flags).find((k) => !FLAGS.has(k));
  if (bad) return { text: `broker: unknown option --${bad}\n${USAGE}`, code: 2 };
  if (flags._.length && !COMMANDS.has(flags._[0])) return { text: `broker: unknown command ${flags._[0]}\n${USAGE}`, code: 2 };
  return null;
}
