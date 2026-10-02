#!/usr/bin/env node
// The resident q-server has no console, so every child process on its import graph must pass
// windowsHide: true or Windows opens a console window per spawn.
// Run: node scripts/q-server-windowshide.test.mjs

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const SPAWN = /\b(spawnSync|spawn|execFileSync|execFile|execSync|exec|fork)\s*\(/g;
const IMPORT = /from\s+'(\.[^']+\.mjs)'/g;

function graph(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = readFileSync(entry, 'utf8');
  for (const m of src.matchAll(IMPORT)) graph(resolve(dirname(entry), m[1]), seen);
  return seen;
}

function callEnd(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i;
  }
  return src.length;
}

const files = graph(resolve(here, 'q-server.mjs'));
let calls = 0;
const bad = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!/node:child_process/.test(src)) continue;
  for (const m of src.matchAll(SPAWN)) {
    const before = src.slice(0, m.index);
    if (/\.\s*$/.test(before) || /function\s+$/.test(before)) continue;
    calls++;
    const open = m.index + m[0].length - 1;
    if (!/windowsHide:\s*true/.test(src.slice(open, callEnd(src, open)))) bad.push(`${file}:${before.split('\n').length} ${m[1]}`);
  }
}

assert.ok(calls > 0, 'no child-process calls found; scanner is blind');
assert.deepEqual(bad, [], `child-process calls without windowsHide: true:\n${bad.join('\n')}`);
console.log(`q-server-windowshide: ${files.size} modules, ${calls} calls, 1 passed, 0 failed`);
