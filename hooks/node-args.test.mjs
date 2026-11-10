#!/usr/bin/env node
// node-args.test.mjs — node's option grammar decides which script a `node` call runs (KIT-T939): options that take
// a value are skipped, inline code (-e, -p, -pe, --eval=, --print=) and stdin run no script, an option the module
// cannot place yields '' so a kit verb is never assumed.
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
  ['-r takes a value', ['-r', 'preload.cjs', 'scripts/q.mjs'], 'q.mjs'],
  ['--require takes a value', ['--require', 'preload.cjs', 'scripts/q.mjs'], 'q.mjs'],
  ['--import takes a value', ['--import', 'hooks.mjs', 'scripts/q.mjs'], 'q.mjs'],
  ['--loader takes a value', ['--loader', 'l.mjs', 'scripts/q.mjs'], 'q.mjs'],
  ['--experimental-loader takes a value', ['--experimental-loader', 'l.mjs', 'scripts/q.mjs'], 'q.mjs'],
  ['--env-file takes a value', ['--env-file', '.env', 'scripts/q.mjs'], 'q.mjs'],
  ['-C takes a value', ['-C', 'dev', 'scripts/q.mjs'], 'q.mjs'],
  ['--conditions takes a value', ['--conditions', 'dev', 'scripts/q.mjs'], 'q.mjs'],
  ['an =-joined option is self-contained', ['--max-old-space-size=4096', 'scripts/q.mjs'], 'q.mjs'],
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
  ['a value option, then -e', ['-r', 'scripts/q.mjs', '-e', 'x']],
  ['stdin', ['-', 'scripts/q.mjs']],
  ['an option the module cannot place', ['--inspect-brk', 'scripts/q.mjs']],
  ['an unplaceable short flag', ['-i', 'scripts/q.mjs']],
  ['a value option with no value left', ['-r']],
  ['nothing', []],
];
for (const [name, args] of NONE) check(`no script: ${name}`, nodeScriptName(args) === '', nodeScriptName(args));

for (const flag of ['-e', '-p', '-pe', '-ep', '--eval', '--eval=x', '--print', '--print=x']) check(`inline flag: ${flag}`, isNodeInlineFlag(flag));
for (const flag of ['-r', '-C', '-c', '--check', '--require', '--no-warnings', 'q.mjs', '--evaluate']) check(`not an inline flag: ${flag}`, !isNodeInlineFlag(flag));

const kit = (line) => kitLed(line);
check('kitLed: node with value options then a kit script', kit('node --no-warnings --require ./preload.cjs /k/scripts/q.mjs code x'));
check('kitLed: node at a quoted path with a space', kit('node "C:/Users/Chris Sparks/rt/scripts/q.mjs" code x'));
check('kitLed: a bare kit verb', kit('q code x'));
check('negative control: node -r <kit script> -e is not a kit verb', !kit('node -r scripts/q.mjs -e "x"'));
check('negative control: node -pe naming a kit script is not a kit verb', !kit('node -pe "scripts/t.mjs"'));
check('negative control: node --import <kit script> --eval= is not a kit verb', !kit('node --import scripts/t.mjs --eval="x"'));
check('negative control: an unplaceable option is not a kit verb', !kit('node --inspect-brk scripts/q.mjs'));
check('shellArgs keeps a quoted span whole', shellArgs('node "a b/q.mjs" x').join('|') === 'node|a b/q.mjs|x');

const writeCode = `require('fs').writeFileSync('hooks/x.mjs','x')`;
check('gate: node -pe writing a source file is found', !!shellSourceWrite(`node -pe "${writeCode}"`));
check('gate: node --eval= writing a source file is found', !!shellSourceWrite(`node --eval="${writeCode}"`));
check('gate: node --print= writing a source file is found', !!shellSourceWrite(`node --print="${writeCode}"`));
check('gate: node -pe reading a source file passes', shellSourceWrite(`node -pe "require('fs').readFileSync('hooks/x.mjs','utf8')"`) === null);
check('gate: a kit script behind value options and escaped quotes passes', shellSourceWrite('node --no-warnings -r ./p.cjs /k/scripts/q.mjs code "a > \\"b\\" rm"') === null);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
