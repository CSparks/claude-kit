// usage.mjs — broker.mjs argument validation (KIT-T501). Unknown commands or flags and `--help`
// print usage and exit before anything is created or started.
//
// `usageProblem(flags)` → null | { text, code }: code 0 for help, 2 for a bad argument.

const COMMANDS = new Set(['pause', 'resume', 'cancel', 'status', 'stop']);
const FLAGS = new Set(['_', 'root', 'log', 'once', 'poll', 'idle-exit', 'spawned-by', 'now', 'help']);

export const USAGE = [
  'usage: broker.mjs [--root <checkout>] [command] [options]',
  '  (no command)   run the daemon; options: --once --poll <ms> --idle-exit <min> --log <file|auto>',
  '  status         show the daemon, queue and suite state',
  '  pause|resume   stop or resume starting jobs',
  '  cancel <id>    withdraw a queued job',
  '  stop [--now]   stop the daemon after its current job; refuses while a job is queued or running unless --now',
].join('\n');

export function usageProblem(flags) {
  if (flags.help) return { text: USAGE, code: 0 };
  const bad = Object.keys(flags).find((k) => !FLAGS.has(k));
  if (bad) return { text: `broker: unknown option --${bad}\n${USAGE}`, code: 2 };
  if (flags._.length && !COMMANDS.has(flags._[0])) return { text: `broker: unknown command ${flags._[0]}\n${USAGE}`, code: 2 };
  return null;
}
