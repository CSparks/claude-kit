// lexer-argv-gen.mjs — regenerates hooks/lexer-argv.fixture.json: what real bash passes to a command, for the command lines the
// upstream gate must read the way the shell does (KIT-T1564). Each line runs in a scratch directory with bash functions named
// argv, bash, sh, eval, ssh, su and t that print their arguments; the fixture pins those arguments.
// Run: node hooks/lexer-argv-gen.mjs <out.json>   (needs bash on PATH), then copy the file to hooks/lexer-argv.fixture.json.
//
// `gate` is the verdict the upstream gate's quoting check must give the line under bash: blocked when it holds a compound or
// function it does not walk, or an escaped quote outside a kit verb, else clear. `compare: false` marks a line whose argument
// list the lexer is not asked to reproduce (a function body, a case arm).

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const CLEAR = 'clear';
const BLOCKED = 'blocked';
const BS = String.fromCharCode(92);
const DQ = '"';
const SQ = "'";
const esc = (s) => s.split('{BS}').join(BS).split('{DQ}').join(DQ);

const cases = [
  ['argv a b c'], ['argv "a b" c'], ["argv 'a b' \"c d\""], ['argv a"b c"d'], [`argv 'it'"'"'s'`],
  ['argv "say {BS}{DQ}hi{BS}{DQ}"', BLOCKED], ['argv say{BS} {BS}{DQ}hi{BS}{DQ}', BLOCKED], ['argv {BS}{DQ}a{BS}{DQ} b', BLOCKED],
  ['argv "a{BS}{BS}b"'], ["argv 'a{BS}b'"], ['argv a{BS} b'], ['argv "{BS}$HOME"'], ["argv '$HOME' \"{BS}$HOME\""],
  ['argv "a\'b"'], ["argv 'a\"b'"], ['argv ""'], ["argv '' x"], ['argv a#b'], ['argv a #comment'], ['argv --repo=bevy/x -R CSparks/y'],
  ['argv -R"a b"'], ['argv "a"\'b\'c'],
  ['FOO=1 argv a'], ['FOO="x y" BAR=2 argv a'], ['>out argv a'], ['argv a >out b'], ['argv a > out'], ['argv a 2>&1'],
  ['argv a 2>/dev/null b'], ['</dev/null argv a'], ['FOO=1 >out argv a'], ['argv a >"o ut" b'], ['argv a &>out'], ['>out FOO=1 argv a'],
  ['time argv a'], ['! argv a'],
  ['if true; then argv a; fi'], ['if argv a; then argv b; fi'], ['for i in 1; do argv a; done', BLOCKED], ['{ argv a; }'], ['( argv a )'], ['(argv a)'],
  ['true && argv a'], ['false || argv a'], ['argv a; argv b'], ['argv a && argv b'], ['argv a & wait'], ['echo x | argv a'], ['argv a | cat'],
  ['case x in x) argv a;; esac', BLOCKED, false], ['f() { argv x; }; f', BLOCKED, false],
  ["bash -c 'argv a \"b c\"'"], ['bash -c "argv {BS}{DQ}a b{BS}{DQ}"', BLOCKED], ["sh -c 'argv a; argv b'"], ['eval "argv a"'], ['ssh host "argv a"'],
  ['su -c "argv a" root'], ['bash -c "argv {BS}{DQ}a{BS}{DQ}; argv b"', BLOCKED], ["eval 'argv \"a b\"'"], ["bash -lc 'argv a'"],
  ['argv {BS}{DQ}x{BS}{DQ} {BS}\'y{BS}\'', BLOCKED], ['FOO={BS}{DQ}x{BS}{DQ} argv a', BLOCKED], ['t notes KIT-T1 "text {BS}{DQ}git push{BS}{DQ} more"', CLEAR],
  ['FOO=1 t notes "a b"'], ['t notes a{BS}{DQ}b', CLEAR],
  ['argv a{BS} #b c'], ['argv a {BS}#b c'], ['argv a#b c'], ['argv a-#b c'], ['argv a "#b" c'], ["argv a '#b' c"], ['argv a;#x'], ['argv a{BS};#b'],
  ['argv a #b c'], ['argv a;argv b #c'], ['argv "a #b" c'],
  ['time -p argv a'], ['time -p time -p argv a'],
  ['! for i in 1; do argv a; done', BLOCKED], ['{ for i in 1; do argv a; done; }', BLOCKED], ['( for i in 1; do argv a; done )', BLOCKED],
  ['{ case x in x) argv a;; esac; }', BLOCKED, false], ['! f() { argv x; }; f', BLOCKED, false], ['if true; then for i in 1; do argv a; done; fi', BLOCKED],
  ['if true; then argv a; fi; function g { argv b; }; g', BLOCKED, false],
].map(([line, gate = CLEAR, compare = true]) => ({ line: esc(line), gate, compare }));

const PRELUDE = 'argv() { { echo "--"; for a in "$@"; do printf "A:%s\\n" "$a"; done; } >>"$ARGV_LOG"; }; bash() { argv "$@"; }; sh() { argv "$@"; }; eval() { argv "$@"; }; ssh() { argv "$@"; }; su() { argv "$@"; }; t() { argv "$@"; };';

const dir = mkdtempSync(join(tmpdir(), 'lexer-argv-'));
const log = join(dir, 'argv.log');
const fixture = cases.map((c) => {
  writeFileSync(log, '');
  spawnSync('bash', ['-c', `${PRELUDE}\n${c.line}`], { cwd: dir, encoding: 'utf8', env: { ...process.env, ARGV_LOG: log.replace(/\\/g, '/') } });
  const invocations = [];
  for (const out of readFileSync(log, 'utf8').split('\n')) {
    if (out === '--') invocations.push([]);
    else if (out.startsWith('A:')) invocations.at(-1).push(out.slice(2));
  }
  return { ...c, invocations };
});

writeFileSync(process.argv[2], `[\n${fixture.map((f) => JSON.stringify(f)).join(',\n')}\n]\n`);
console.log(`${fixture.length} lines, ${fixture.filter((f) => !f.invocations.length).length} with no invocation`);
