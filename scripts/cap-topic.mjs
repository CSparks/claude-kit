// `cap topic [<slug>]` — read or set the SESSION's topic label (KIT-T189).
//
// A store that is not bounded by a repo holds several unrelated threads at once, so each
// captured item carries a topic. The label is set EXPLICITLY here and never derived from a
// prompt: a guessed label is worse than none. It is changeable mid-session, and every capture
// after the change carries the new one.

import { readIdentity, writeIdentity, normalizeTopic, noStoreMessage } from '../hooks/lib.mjs';

const SESSION_SHORT = 8; // session ids are long; a prefix is enough to recognize one

// Run the subcommand against `aiDir` (null when the cwd resolved to no store). Returns the
// process exit code; prints its own receipt.
export function runTopic(argv, aiDir) {
  if (!aiDir) {
    process.stderr.write(`cap topic: ${noStoreMessage()}.\n`);
    return 1;
  }
  if (argv.length === 1) {
    const { topic, session } = readIdentity(aiDir);
    process.stdout.write(topic
      ? `topic: ${topic}${session ? ` (session ${session.slice(0, SESSION_SHORT)})` : ''}\n`
      : 'topic: (none set) — cap topic <slug>\n');
    return 0;
  }
  const slug = normalizeTopic(argv[1]);
  if (!slug) {
    process.stderr.write(`cap topic: '${argv[1]}' has no slug characters — use letters, digits, dashes.\n`);
    return 1;
  }
  const before = readIdentity(aiDir).topic;
  writeIdentity(aiDir, { topic: slug });
  process.stdout.write(`topic: ${slug}${before && before !== slug ? ` (was ${before})` : ''}\n`);
  return 0;
}
