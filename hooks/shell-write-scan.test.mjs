#!/usr/bin/env node
// shell-write-scan.test.mjs — KIT-T951: a redirect is judged on every segment, kit-led or not (a `>` inside a
// quoted pattern is no redirect there), and a node call that loads modules through a code-loading option
// is judged on every module it loads, not only the first script word.
// Run: node hooks/shell-write-scan.test.mjs

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shellSourceWrite } from './lib/shell-source-write.mjs';
import { shellStoreWrite } from './lib/store-shell-write.mjs';
import { nodeLoadedModules } from './lib/node-args.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const blocks = (name, command) => check(`blocks ${name}`, !!shellSourceWrite(command), command);
const passes_ = (name, command) => check(`allows ${name}`, shellSourceWrite(command) === null, command);

const REDIRECT_INTO_SOURCE = [
  ['a q call redirected into a source file', 'q code x > hooks/a.mjs'],
  ['a q call appended to a source file', 'q code x >> hooks/a.mjs'],
  ['a q call redirected to a quoted source path', 'q code x > "hooks/a.mjs"'],
  ['a q call with a quoted pattern then a redirect', 'q code "a > b" > hooks/a.mjs'],
  ['a kit script through node redirected into a source file', 'node scripts/q.mjs code x > hooks/a.mjs'],
  ['t redirected into a source file', 't show KIT-T1 > scripts/a.mjs'],
  ['an escaped-quote q call with a trailing redirect', 'q code "a \\"b\\"" > hooks/a.mjs'],
  ['an escaped-quote kit script call with a trailing append', 'node "/k/scripts/q.mjs" code "a \\"b\\"" >> hooks/a.mjs'],
  ['git show redirected into a source file', 'git show HEAD:hooks/a.mjs > hooks/a.mjs'],
  ['a kit pipeline into a redirect', 'q code x | head -5 > hooks/a.mjs'],
];
for (const [name, command] of REDIRECT_INTO_SOURCE) blocks(name, command);

const REDIRECT_CONTROLS = [
  ['a q pattern holding > and a source path', 'q code "x > hooks/a.mjs"'],
  ['a q pattern holding >> in single quotes', "q code 'x >> hooks/a.mjs'"],
  ['a q regex holding an arrow', 'q code --regex "-> hooks/a.mjs" --path src'],
  ['a q call redirected to the temp dir', `q code x > ${join(tmpdir(), 'o.txt').replace(/\\/g, '/')}`],
  ['a q call redirected to a data file', 'q code x > out.json'],
  ['a q call with stderr to the null device', 'q code x 2> /dev/null'],
  ['a q call with a stderr merge', 'q code x 2>&1'],
  ['git diff redirected to a patch file', 'git diff > out.patch'],
  ['git log with > in a quoted format', 'git log --format="%s > hooks/a.mjs"'],
  ['an escaped-quote q call with no redirect', 'q code "a \\"b\\" > c"'],
  ['an escaped-quote q call redirected to a data file', 'q code "a \\"b\\"" > out.json'],
];
for (const [name, command] of REDIRECT_CONTROLS) passes_(name, command);

check('the store gate blocks a kit verb redirected into the work store', !!shellStoreWrite('q show KIT-T1 > .ai/notes/a.md'));
check('the store gate allows a kit verb redirected elsewhere', shellStoreWrite('q show KIT-T1 > out.md') === null);
check('the store gate allows a quoted > in a kit pattern', shellStoreWrite('q code "a > .ai/notes/a.md"') === null);

const dir = mkdtempSync(join(tmpdir(), 'kit-scan-'));
const at = (name) => join(dir, name).replace(/\\/g, '/');
const writer = at('evil.mjs');
const reader = at('reader.mjs');
const dataWriter = at('data.mjs');
writeFileSync(writer, "import fs from 'node:fs';\nfs.writeFileSync('src/lib.rs', 'x');\n");
writeFileSync(reader, "console.log('hello');\n");
writeFileSync(dataWriter, "import fs from 'node:fs';\nfs.writeFileSync('out.json', 'x');\n");
const evilData = `data:text/javascript,require('fs').writeFileSync('hooks/x.mjs','x')`;

try {
  const LOADERS = [
    ['a scratch preload after a repo preload', `node -r ./lib/pre.js ${writer} app.mjs`],
    ['--import=<scratch module>', `node --import=${writer} app.mjs`],
    ['--require=<scratch module>', `node --require=${writer} app.mjs`],
    ['--import <scratch module>', `node --import ${writer} app.mjs`],
    ['--experimental-loader=<scratch module>', `node --experimental-loader=${writer} app.mjs`],
    ['-r <scratch module> before a kit script path', `node -r ${writer} scripts/q.mjs code x`],
    ['--import= a data: URL', `node --import="${evilData}" app.mjs`],
    ['--import a data: URL', `node --import "${evilData}" app.mjs`],
  ];
  for (const [name, command] of LOADERS) blocks(name, command);

  const LOADER_CONTROLS = [
    ['a package preload', 'node --import tsx app.mjs'],
    ['a package -r', 'node -r ts-node/register app.mjs'],
    ['a repo preload', 'node -r ./lib/pre.js app.mjs'],
    ['--env-file=.env', 'node --env-file=.env app.mjs'],
    ['a scratch preload that only reads', `node --import=${reader} app.mjs`],
    ['a scratch preload that writes a data file', `node -r ${dataWriter} app.mjs`],
    ['a data: URL that only logs', `node --import "data:text/javascript,console.log(1)" app.mjs`],
    ['a repo script', 'node app.mjs'],
  ];
  for (const [name, command] of LOADER_CONTROLS) passes_(name, command);
  check('control: a scratch script run plainly still blocks', !!shellSourceWrite(`node ${writer}`));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LOADED = [
  ['-r <module>', ['-r', 'a.js', 'x.mjs'], ['a.js']],
  ['-r<module>', ['-ra.js', 'x.mjs'], ['a.js']],
  ['--require <module>', ['--require', 'a.js', 'x.mjs'], ['a.js']],
  ['--require=<module>', ['--require=a.js', 'x.mjs'], ['a.js']],
  ['--import=<module>', ['--import=a.mjs', 'x.mjs'], ['a.mjs']],
  ['--loader <module>', ['--loader', 'a.mjs', 'x.mjs'], ['a.mjs']],
  ['--experimental-loader=<module>', ['--experimental-loader=a.mjs', 'x.mjs'], ['a.mjs']],
  ['--env-file <file>', ['--env-file', '.env', 'x.mjs'], ['.env']],
  ['two loaders', ['-r', 'a.js', '--import', 'b.mjs', 'x.mjs'], ['a.js', 'b.mjs']],
  ['no loader', ['--no-warnings', 'x.mjs'], []],
  ['arguments after the script belong to it', ['x.mjs', '-r', 'a.js'], []],
  ['a loader option with no value left', ['-r'], []],
];
for (const [name, args, want] of LOADED) check(`nodeLoadedModules: ${name}`, same(nodeLoadedModules(args), want), JSON.stringify(nodeLoadedModules(args)));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
