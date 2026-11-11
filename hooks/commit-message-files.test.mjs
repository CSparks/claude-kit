// The commit message file and the pathspec file set (KIT-T1019, KIT-T364, KIT-T1020): commit-message.mjs reads the message
// a `git commit -F <file>` carries, and commit-files.mjs keeps untracked entries out of the set a pathspec commit includes.
// Run: node hooks/commit-message-files.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';
import { commitMessageFile, commitMessageText } from './lib/commit-message.mjs';
import { pathspecFiles } from './lib/commit-files.mjs';

const { ok, done } = reporter('commit-message-files');

try {
  const dir = tmpDir('commit-msg-');
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'msg.txt'), 'change a (implements KIT-T1)\n');
  writeFileSync(join(dir, 'sub', 'm.txt'), 'nested (implements KIT-T2)\n');

  const named = (command) => commitMessageFile(command)?.path;
  ok('-F <file> names the file', named('git commit -F msg.txt') === 'msg.txt');
  ok('-F<file> glued', named('git commit -Fmsg.txt') === 'msg.txt');
  ok('-aF <file> in a cluster', named('git commit -aF msg.txt') === 'msg.txt');
  ok('--file <file>', named('git commit --file msg.txt') === 'msg.txt');
  ok('--file=<file>', named('git commit --file=msg.txt') === 'msg.txt');
  ok('a quoted file name with a space', named('git commit -F "my msg.txt"') === 'my msg.txt');
  ok('the file after a pathspec separator is a path, not the message', commitMessageFile('git commit -- -F msg.txt') === null);
  ok('git -C <dir> commit -F is read', named('git -C /r commit -F msg.txt') === 'msg.txt');
  ok('-F - is stdin, not a file', commitMessageFile('git commit -F -')?.stdin === true && commitMessageFile('git commit --file=-')?.stdin === true);
  ok('negative control: -m "<text mentioning -F x>" names no file', commitMessageFile('git commit -m "fix -F handling"') === null);
  ok('negative control: a -F after another value option is read from its own position', named('git commit -m "a" -F msg.txt') === 'msg.txt');
  ok('negative control: no commit, no file', commitMessageFile('git status -F msg.txt') === null);
  ok('negative control: -F with no value names nothing', commitMessageFile('git commit -F') === null);

  ok('the text of the file is read', commitMessageText('git commit -F msg.txt', dir).includes('KIT-T1'));
  ok('a relative file is read from the commit directory', commitMessageText('git commit -F m.txt', join(dir, 'sub')).includes('KIT-T2'));
  ok('negative control: stdin yields no text', commitMessageText('git commit -F -', dir) === '');
  ok('negative control: a missing file yields no text', commitMessageText('git commit -F nope.txt', dir) === '');
  ok('negative control: no -F yields no text', commitMessageText('git commit -m "x"', dir) === '');

  const porcelain = ' M src/a.mjs\n?? target/\nA  src/new.mjs\nR  old.mjs -> src/renamed.mjs\n?? notes.txt\n';
  ok('a pathspec commit keeps tracked entries and drops untracked ones', pathspecFiles(porcelain).join() === 'src/a.mjs,src/new.mjs,src/renamed.mjs');
  ok('negative control: a modified file is kept', pathspecFiles(' M a.mjs\n').join() === 'a.mjs');
  ok('negative control: nothing but untracked entries leaves nothing', pathspecFiles('?? target/\n').length === 0);
  ok('a quoted path loses its quotes', pathspecFiles(' M "my file.mjs"\n').join() === 'my file.mjs');
} finally {
  cleanup();
}

done();
