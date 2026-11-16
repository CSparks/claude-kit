// source-shell-gate-compound-kit (KIT-T1316): a kit call (`q`, `cap`, `t`, `node q.mjs`) led by a compound-command keyword
// (`do`, `then`, `else`, `{`, `(`, `!`) or an env assignment is judged like the same call typed alone: its quoted arguments,
// its flag values (`--path $S/x.rs`) and a `2>&1` fd dup are data, never a write target. A real redirect or `tee` still blocks.
// Run: node hooks/source-shell-gate-compound-kit.test.mjs

import { shellSourceWrites } from './lib/shell-source-write.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const hits = (command) => shellSourceWrites(command, { shell: 'bash' });
const allows = (name, command) => check(`allows ${name}`, hits(command).length === 0, JSON.stringify(hits(command)));
const blocks = (name, command) => check(`blocks ${name}`, hits(command).length > 0, command);

const Q = 'node "$Q" code';
const ALTERNATION = "'register_builtins|fn install|pub fn with_builtins'";

allows('the reported loop: node "$Q" with a write word in the pattern, --path $S/x.rs, 2>&1 and head', `S=crates/a/src\nfor w in a b; do\n  ${Q} 'sed -i x' --path $S/graphics_words.rs 2>&1 | head -2\ndone`);
allows('the reported loop with rm and install in an alternation', `for w in a b; do ${Q} 'rm x|fn install' --path $S/graphics_words.rs 2>&1 | head -2; done`);
allows('a loop without any write word in the pattern', `for w in a b; do ${Q} 'foo' --path $S/graphics_words.rs 2>&1 | head -2; done`);
allows('a regex alternation holding install in a loop', `for w in a b; do ${Q} ${ALTERNATION} --path rapid-game/crates/x --lang rust 2>&1 | head -2; done`);
allows('a regex alternation holding install behind a --path source file', `for w in a; do\n  ${Q} ${ALTERNATION} --path $S/any.rs 2>&1 | head -2\ndone`);
allows('a q call after then', "if true; then q code 'fn install|pub x' src/any.rs; fi");
allows('a q call after else', "if false; then true; else q code 'fn install|pub x' src/any.rs; fi");
allows('a q call in a brace group', "{ q code 'fn install|pub x' src/any.rs; }");
allows('a q call in a subshell', "(q code 'fn install|pub x' src/any.rs)");
allows('a negated q call', "! q code 'fn install|pub x' src/any.rs");
allows('a q call behind an env assignment', "RUST_LOG=x q code 'fn install|pub x' src/any.rs");
allows('a q call behind an env assignment in a loop', "for w in a; do FOO=1 node \"$Q\" code 'fn install|x' --path $S/any.rs; done");
allows('a cap call after do with a write word in its text', "for w in a; do cap note 'rm src/a.rs and sed -i it' ; done");
allows('a while loop reading a list into q', 'while read l; do q code "$l" --path $S/g.rs; done < list.txt');
allows('a 2>&1 fd dup into head after a kit call', 'q code x --path $S/a.rs 2>&1 | head -2');
allows('stderr to the null device in a loop', 'for w in a; do q code x --path $S/a.rs 2> /dev/null | head; done');

blocks('a kit call in a loop redirected into a source file', 'for w in a; do q code x --path $S/a.rs > hooks/a.mjs; done');
blocks('a kit call after then appended to a source file', 'if true; then q code x >> hooks/a.mjs; fi');
blocks('a 2>&1 merge then a real redirect into a source file', 'for f in a; do q code x --path $S/a.rs 2>&1 > hooks/a.mjs; done');
blocks('a kit call piped to tee into a source file in a loop', 'for f in a; do q code x --path $S/a.rs 2>&1 | tee hooks/a.mjs; done');
blocks('a kit call piped to tee into a source file', 'q code x | tee hooks/a.mjs');
blocks('a plain redirect into a source file', 'q code x > hooks/a.mjs');
blocks('a plain tee into a source file', 'echo hi | tee hooks/a.mjs');
blocks('an install of a source file in a loop', 'for w in a; do install a.txt hooks/a.mjs; done');
blocks('a cp onto a source file behind do', 'for w in a; do cp a.txt hooks/a.mjs; done');
blocks('a write behind an env assignment', 'FOO=1 tee hooks/a.mjs');
blocks('a node call on a variable script redirected into a source file', 'node "$Q" code x > hooks/a.mjs');
blocks('a node call on a literal non-kit script with a write word argument', 'node scripts/tool.mjs install a.txt hooks/a.mjs');
blocks('a sed -i after a kit call in the same loop', 'for w in a; do q code x; sed -i s/a/b/ hooks/a.mjs; done');

console.log(`\nsource-shell-gate-compound-kit: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
