// lexer-argv.test.mjs — the one shell lexer the security gates read argv with agrees with real bash (KIT-T1564).
// hooks/lexer-argv.fixture.json pins, for each command line, the arguments bash passed to the command (regenerate with
// hooks/lexer-argv-gen.mjs). Each line is read with the lexer, its redirections and their targets dropped, the command found
// past assignments and wrappers, and its arguments compared with the pinned ones; the quoting check the upstream gate runs
// must give the pinned verdict. Run: node hooks/lexer-argv.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { leadIndex } from './lib/command-lead.mjs';
import { quotingHidesSubmission } from './lib/escaped-quote-gate.mjs';
import { words } from './lib/shell-lexer.mjs';
import { segments } from './lib/shell-segments.mjs';
import { reporter } from './test-harness.mjs';

const { ok, done } = reporter('lexer-argv');
const FIXTURE = JSON.parse(readFileSync(fileURLToPath(new URL('./lexer-argv.fixture.json', import.meta.url)), 'utf8'));
const COMMANDS = new Set(['argv', 'bash', 'sh', 'eval', 'ssh', 'su', 't']);
const MIN_LINES = 50;

function lexedInvocations(line) {
  return [...segments(line, { shell: 'bash' })].flatMap(({ text }) => {
    const argv = words(text, { shell: 'bash' }).filter((w) => !w.redirect).map((w) => w.value);
    const at = leadIndex(argv, (name) => COMMANDS.has(name), { extraWrapper: /^\{$/ });
    return at < 0 ? [] : [argv.slice(at + 1)];
  });
}

ok(`the table holds at least ${MIN_LINES} command lines`, FIXTURE.length >= MIN_LINES);
for (const { line, gate, compare, invocations } of FIXTURE) {
  if (compare) {
    const lexed = lexedInvocations(line);
    ok(`argv of ${line}`, JSON.stringify(lexed) === JSON.stringify(invocations));
  }
  ok(`gate verdict of ${line}: ${gate}`, quotingHidesSubmission(line, 'bash') === (gate === 'blocked'));
}
done();
