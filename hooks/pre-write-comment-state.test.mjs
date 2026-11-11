// pre-write magic-numbers (KIT-T966): an Edit fragment is judged with the comment state the whole file holds at the
// fragment's offset, so a numeric line inside a /** */ block is prose even when the fragment omits the opening
// `/**`. Code after the comment, or a numeric in code, still blocks.
// Run: node hooks/pre-write-comment-state.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('pre-write-comment-state');

try {
  const repo = tmpDir('pw-comment-');
  execFileSync('git', ['init', '-q'], { cwd: repo, stdio: 'ignore' });
  mkdirSync(join(repo, '.ai'));
  const file = join(repo, 'range.ts');
  const source = [
    '/**',
    ' * Pitch range in semitones.',
    ' * Notes outside the window are dropped.',
    ' */',
    'export function clamp(x: number): number {',
    '  return Math.max(x, 0);',
    '}',
    '',
  ].join('\n');
  writeFileSync(file, source);
  const edit = (oldString, newString) => hook('pre-write.mjs', { tool_input: { file_path: file, old_string: oldString, new_string: newString } }, repo);
  const blocksMagic = (r) => r.code === 2 && r.out.includes('magic-numbers');

  const prose = edit(' * Pitch range in semitones.', ' * Range is 4095 semitones.');
  ok('a numeric in a doc-comment line edited without the opening /** passes', prose.code === 0);

  const second = edit(' * Notes outside the window are dropped.', ' * Notes beyond 4095 are dropped.');
  ok('a numeric in a later comment line passes', second.code === 0);

  const code = edit('  return Math.max(x, 0);', '  return x * 1337;');
  ok('control: a numeric in code after the comment still blocks', blocksMagic(code) && code.out.includes('1337'));

  const closes = edit(
    ' * Notes outside the window are dropped.\n */\nexport function clamp(x: number): number {\n  return Math.max(x, 0);',
    ' * Notes beyond 4095 are dropped.\n */\nexport function clamp(x: number): number {\n  return x * 1337;',
  );
  ok('control: a fragment that starts in the comment and ends in code blocks the code literal only', blocksMagic(closes) && closes.out.includes('1337') && !closes.out.includes('4095'));

  const midLine = join(repo, 'consts.ts');
  writeFileSync(midLine, 'export const a = 1;\nexport const c = 3;\n');
  const partial = hook('pre-write.mjs', { tool_input: { file_path: midLine, old_string: 'a = 1;\nexport', new_string: 'a = 9;\nexport' } }, repo);
  ok('a fragment that starts and ends mid-line is judged on its own characters, not the whole lines', partial.code === 0);

  const bare = hook('pre-write.mjs', { tool_input: { file_path: join(repo, 'bare.ts'), content: 'export function f(x) {\n  return x * 1337;\n}\n' } }, repo);
  ok('control: a Write with a magic number in code still blocks', blocksMagic(bare));
} finally {
  cleanup();
}

done();
