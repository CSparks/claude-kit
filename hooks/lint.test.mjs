// lint hook: skip rules (lockfiles, vendored paths) are silent, and a missing toolchain
// warns without ever blocking. Gap logs go to a throwaway HOME.
// Run: node hooks/lint.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { adopted, cleanup, homeEnv, hook, quietHome, reporter } from './test-harness.mjs';

const { ok, done } = reporter('lint');

try {
  const env = homeEnv(quietHome());
  const lr = adopted(false);

  writeFileSync(join(lr, 'package-lock.json'), '{}');
  let r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'package-lock.json') } }, lr, env);
  ok('lint: lockfile skipped silently', r.code === 0 && r.out.trim() === '');

  mkdirSync(join(lr, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(lr, 'node_modules', 'x', 'y.js'), 'var a = 1;\n');
  r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'node_modules', 'x', 'y.js') } }, lr, env);
  ok('lint: vendored path skipped silently', r.code === 0 && r.out.trim() === '');

  writeFileSync(join(lr, 'app.ts'), 'export const a = 1;\n');
  r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'app.ts') } }, lr, env);
  ok('lint: ts without package.json warns but never blocks', r.code === 0 && r.out.includes('No package.json'));
} finally {
  cleanup();
}

done();
