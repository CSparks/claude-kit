#!/usr/bin/env node
// node-args.test.mjs — node's option grammar decides which script a `node` call runs (KIT-T939): harmless value
// options are skipped; inline code (-e, -p, -pe, --eval=, --print=), stdin, a code-loading option (-r, --require,
// --import, --loader, --experimental-loader, --env-file, in every spelling) and an option the module cannot place
// yield '' so a kit verb is never assumed.
// Run: node hooks/node-args.test.mjs

import { isNodeInlineFlag, nodeScriptName } from './lib/node-args.mjs';
import { kitLed, shellArgs } from './lib/shell-write-scan.mjs';
import { shellSourceWrite } from './lib/shell-source-write.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const SCRIPT = [
  ['a bare script', ['scripts/q.mjs', 'code'], 'q.mjs'],
  ['boolean flags before the script', ['--no-warnings', '--enable-source-maps', 'scripts/t.mjs'], 't.mjs'],
  ['-C takes a harmless value', ['-C', 'dev', 'scripts/q.mjs'], 'q.mjs'],
  ['--conditions takes a harmless value', ['--conditions', 'dev', 'scripts/q.mjs'], 'q.mjs'],
  ['--input-type takes a harmless value', ['--input-type', 'module', 'scripts/q.mjs'], 'q.mjs'],
  ['--title takes a harmless value', ['--title', 'kit', 'scripts/q.mjs'], 'q.mjs'],
  ['an =-joined harmless option is self-contained', ['--max-old-space-size=4096', 'scripts/q.mjs'], 'q.mjs'],
  ['-- ends the options', ['--', 'scripts/q.mjs'], 'q.mjs'],
  ['a script path under Windows separators', ['C:\\k\\scripts\\q.mjs'], 'q.mjs'],
];
for (const [name, args, want] of SCRIPT) check(`script: ${name}`, nodeScriptName(args) === want, nodeScriptName(args));

const NONE = [
  ['-e', ['-e', 'x']],
  ['-p', ['-p', 'x']],
  ['-pe', ['-pe', 'x']],
  ['-ep', ['-ep', 'x']],
  ['--eval', ['--eval', 'x']],
  ['--eval=', ['--eval=x']],
  ['--print=', ['--print=x']],
  ['stdin', ['-', 'scripts/q.mjs']],
  ['an option the module cannot place', ['--inspect-brk', 'scripts/q.mjs']],
  ['an unplaceable short flag', ['-i', 'scripts/q.mjs']],
  ['a harmless value option with no value left', ['-C']],
  ['nothing', []],
];
const LOADERS = ['--require', '--import', '--loader', '--experimental-loader', '--env-file', '--env-file-if-exists'];
for (const opt of LOADERS) {
  NONE.push([`${opt} <module>`, [opt, './evil.js', 'scripts/t.mjs']]);
  NONE.push([`${opt}=<module>`, [`${opt}=./evil.js`, 'scripts/t.mjs']]);
}
NONE.push(['-r <module>', ['-r', './evil.js', 'scripts/t.mjs']], ['-r<module>', ['-r./evil.js', 'scripts/t.mjs']], ['-ri', ['-ri', 'scripts/t.mjs']], ['-Cr', ['-Cr', 'dev', 'scripts/t.mjs']]);
NONE.push(['a loader option, then -e', ['-r', 'scripts/q.mjs', '-e', 'x']]);
for (const [name, args] of NONE) check(`no script: ${name}`, nodeScriptName(args) === '', nodeScriptName(args));

for (const flag of ['-e', '-p', '-pe', '-ep', '--eval', '--eval=x', '--print', '--print=x']) check(`inline flag: ${flag}`, isNodeInlineFlag(flag));
for (const flag of ['-r', '-C', '-c', '--check', '--require', '--no-warnings', 'q.mjs', '--evaluate']) check(`not an inline flag: ${flag}`, !isNodeInlineFlag(flag));

check('kitLed: node with harmless options then a kit script', kitLed('node --no-warnings --conditions dev /k/scripts/q.mjs code x'));
check('kitLed: node at a quoted path with a space', kitLed('node "C:/Users/Chris Sparks/rt/scripts/q.mjs" code x'));
check('kitLed: a bare kit verb', kitLed('q code x'));
for (const [name, line] of [
  ['node -r <module> <kit script>', 'node -r ./evil.js scripts/t.mjs status x'],
  ['node --require=<module> <kit script>', 'node --require=./evil.js scripts/t.mjs status x'],
  ['node --import=<module> <kit script>', 'node --import=./evil.mjs scripts/t.mjs status x'],
  ['node --experimental-loader <module> <kit script>', 'node --experimental-loader ./l.mjs scripts/q.mjs code x'],
  ['node --env-file <file> <kit script>', 'node --env-file .env scripts/q.mjs code x'],
  ['node -r <module> -e', 'node -r scripts/q.mjs -e "x"'],
  ['node -pe naming a kit script', 'node -pe "scripts/t.mjs"'],
  ['node --import <kit script> --eval=', 'node --import scripts/t.mjs --eval="x"'],
  ['node with an unplaceable option', 'node --inspect-brk scripts/q.mjs'],
]) check(`negative control: ${name} is not a kit verb`, !kitLed(line), line);
check('shellArgs keeps a quoted span whole', shellArgs('node "a b/q.mjs" x').join('|') === 'node|a b/q.mjs|x');

const writeCode = `require('fs').writeFileSync('hooks/x.mjs','x')`;
check('gate: node -pe writing a source file is found', !!shellSourceWrite(`node -pe "${writeCode}"`));
check('gate: node --eval= writing a source file is found', !!shellSourceWrite(`node --eval="${writeCode}"`));
check('gate: node --print= writing a source file is found', !!shellSourceWrite(`node --print="${writeCode}"`));
check('gate: node -pe reading a source file passes', shellSourceWrite(`node -pe "require('fs').readFileSync('hooks/x.mjs','utf8')"`) === null);
check('gate: a kit script behind harmless options and escaped quotes passes', shellSourceWrite('node --no-warnings --conditions dev /k/scripts/q.mjs code "a > \\"b\\" rm"') === null);
for (const opt of ['-r ./p.cjs', '--require=./p.cjs', '--import ./p.mjs', '--env-file .env']) {
  const command = `node ${opt} /k/scripts/q.mjs code "rm \\"b\\""`;
  check(`gate: an ambiguous kit script run behind ${opt} is judged as a write`, !!shellSourceWrite(command), command);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
