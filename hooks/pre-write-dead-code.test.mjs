// pre-write `dead-code` check (KIT-D078, KIT-T1599): a history comment ("removed …", "was: …") is refused; a lowercase
// "removed" that wraps an unfinished sentence from the comment line above is a description and passes.
// Run: node hooks/pre-write-dead-code.test.mjs

import { join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';

const { ok, done } = reporter('pre-write-dead-code');
const BLOCK = 2;
const PASS = 0;

try {
  const repo = adopted(false);
  const write = (content) => hook('pre-write.mjs', { tool_name: 'Write', tool_input: { file_path: join(repo, 'src', 'a.mjs'), content } }, repo);
  const blocked = (content) => { const r = write(content); return r.code === BLOCK && r.out.includes('Dead-code trace'); };

  const WRAPPED = '//   chainProducer(command, file) -> the producing segment with its redirect\n//                                   removed, or null when no segment matches\nexport const a = 1;\n';
  ok('KIT-T1599: a doc line wrapping an unfinished sentence onto "removed," passes', write(WRAPPED).code === PASS);
  ok('a lone "// removed the retry loop" trace still blocks', blocked('// removed the retry loop\nexport const a = 1;\n'));
  ok('a "Removed" trace after a finished sentence still blocks', blocked('// Saves the file.\n// Removed the retry loop\nexport const a = 1;\n'));
  ok('a lowercase "removed" after a finished sentence still blocks', blocked('// Saves the file.\n// removed the retry loop\nexport const a = 1;\n'));
  ok('"removed:" after an unfinished line still blocks', blocked('// the save handler\n// removed: the retry loop\nexport const a = 1;\n'));
  ok('a "was:" trace still blocks', blocked('// was: retries = 3\nexport const a = 1;\n'));
  ok('a "# removed" trace in a shell-style comment still blocks', blocked('# removed old flag\nexport const a = 1;\n'));
} finally {
  cleanup();
}
done();
