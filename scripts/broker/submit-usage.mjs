// submit-usage.mjs — submit.mjs prints its usage instead of waiting on stdin (KIT-T550).
//
// `submitUsageProblem(argv, flags, { isTTY })` → null | { text, code }: code 0 for --help / -h,
// code 2 when stdin is a terminal and no envelope can arrive (a patch job without --no-patch).

export const SUBMIT_USAGE = [
  'usage: submit.mjs --root <checkout> --ticket <id> --title "…" [--test "<command>"]... [--repo <name>] [--land] <<\'PATCH\'',
  '  *** edit path/file.rs',
  '  <<<<<<< SEARCH … ======= … >>>>>>> REPLACE',
  '  PATCH',
  '  the patch envelope comes on stdin; --no-patch queues a test-only job instead (no envelope)',
  '  --land (needs --ticket)      commit and push a green patch',
  '  --revises <id>               withdraw a still-queued <id> this job replaces',
  '  --pin <submodule>=<sha>      build and test with the submodule at <sha> (superproject job, repeatable); with --no-patch --land it lands the gitlink alone',
  '  --repo <submodule> --no-pin  push the submodule commit and leave the superproject alone',
  '  *** write-binary art/x.png   a binary file: base64 lines follow; creates or replaces the file whole',
  '  --binary <repo path>=<file>  add a binary file from disk as a write-binary section (repeatable; no stdin envelope needed)',
  '  --diagnosed "<cause>"       after 2 red jobs in a row on a ticket, submit again only with a ticket note since the last red or this (20+ chars)',
  '  --session <id>               sessions are served in turn (default the harness session id)',
  '  wait.mjs <id> blocks on the outcome',
].join('\n');

export function submitUsageProblem(argv, flags, { isTTY = false } = {}) {
  if (flags.help || argv.includes('-h')) return { text: SUBMIT_USAGE, code: 0 };
  if (isTTY && !flags['no-patch'] && !flags.binary) return { text: `submit: no patch envelope on stdin (it is a terminal)\n${SUBMIT_USAGE}`, code: 2 };
  return null;
}
