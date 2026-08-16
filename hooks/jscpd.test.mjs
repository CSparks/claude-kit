// jscpd hook: doc/data extensions and vendored paths are skipped silently, and a missing
// jscpd binary fails open (gap logged to a throwaway HOME, no warning, exit 0).
// Run: node hooks/jscpd.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { adopted, cleanup, homeEnv, hook, quietHome, reporter } from './test-harness.mjs';

const { ok, done } = reporter('jscpd');

try {
  const env = homeEnv(quietHome());
  const lr = adopted(false);
  mkdirSync(join(lr, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(lr, 'node_modules', 'x', 'y.js'), 'var a = 1;\n');
  writeFileSync(join(lr, 'app.ts'), 'export const a = 1;\n');
  writeFileSync(join(lr, 'README.md'), '# x\n');

  let r = hook('jscpd.mjs', { tool_input: { file_path: join(lr, 'README.md') } }, lr, env);
  ok('jscpd: doc/data ext skipped silently', r.code === 0 && r.out.trim() === '');

  r = hook('jscpd.mjs', { tool_input: { file_path: join(lr, 'node_modules', 'x', 'y.js') } }, lr, env);
  ok('jscpd: vendored path skipped silently', r.code === 0 && r.out.trim() === '');

  r = hook('jscpd.mjs', { tool_input: { file_path: join(lr, 'app.ts') } }, lr, env);
  ok('jscpd: missing tool fails open (gap logged, no warn, exit 0)', r.code === 0 && !r.out.includes('WARN'));
} finally {
  cleanup();
}

done();
