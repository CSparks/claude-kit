// no-api-calls.test.mjs — KIT-D112: orchestration runs on the subscription only. No kit script, hook, server or
// broker file reads an Anthropic API key, imports the SDK or calls the API host. Test files may name them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = /\.(?:mjs|cjs|js|ts|py)$/;
const SKIP = /(?:^|\/)(?:node_modules|vendor|target|ui\/node_modules)\/|\.test\.(?:mjs|cjs|js|ts)$|^scripts\/no-api-calls\.test\.mjs$/;
const FORBIDDEN = /ANTHROPIC_API_KEY|api\.anthropic\.com|@anthropic-ai\/sdk|x-api-key|from\s+['"]anthropic['"]|import\s+anthropic\b/;

export const violations = (files, read) => files.filter((f) => SOURCE.test(f) && !SKIP.test(f)).filter((f) => FORBIDDEN.test(read(f)));

test('no tracked kit source reads an API key, imports the SDK or calls the API host', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(violations(files, (f) => readFileSync(join(ROOT, f), 'utf8')), []);
});

test('negative control: the scan flags each forbidden shape and skips test files', () => {
  const sources = {
    'scripts/a.mjs': "const k = process.env.ANTHROPIC_API_KEY;",
    'scripts/b.mjs': "import Anthropic from '@anthropic-ai/sdk';",
    'scripts/c.py': 'import anthropic\n',
    'scripts/d.mjs': "fetch('https://api.anthropic.com/v1/messages')",
    'scripts/ok.mjs': 'const model = "claude-opus-5-5";',
    'scripts/a.test.mjs': 'ANTHROPIC_API_KEY',
  };
  assert.deepEqual(violations(Object.keys(sources), (f) => sources[f]), ['scripts/a.mjs', 'scripts/b.mjs', 'scripts/c.py', 'scripts/d.mjs']);
});
