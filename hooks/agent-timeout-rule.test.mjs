// Agent definitions and dispatch briefs never advise a Bash timeout the broker-wait-gate blocks
// (KIT-D104: no call past 300000 ms). Run: node hooks/agent-timeout-rule.test.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, reporter } from './test-harness.mjs';

const { ok, done } = reporter('agent-timeout-rule');
const MAX_TOOL_TIMEOUT_MS = 300000;
const ADVISES_LONGEST = /\b(max|maximum|longest|highest)\s+timeout\b/i;
const MS_FIGURE = /\b(\d[\d_,]*)\s*ms\b/gi;
const SECONDS_FIGURE = /timeout[^\n]{0,20}?\b(\d+)\s*(?:s|sec|seconds)\b/gi;

const mdIn = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`);
const sources = [...mdIn('agents'), ...mdIn('commands'), 'docs/wait-rule.md', 'hooks/wait-poll.mjs'];

const overCeiling = (text) => {
  const found = [];
  for (const m of text.matchAll(MS_FIGURE)) if (Number(m[1].replace(/[_,]/g, '')) > MAX_TOOL_TIMEOUT_MS) found.push(m[0]);
  for (const m of text.matchAll(SECONDS_FIGURE)) if (Number(m[1]) * 1000 > MAX_TOOL_TIMEOUT_MS) found.push(m[0]);
  return found;
};

ok('scanned the agent definitions', mdIn('agents').filter((a) => !a.endsWith('README.md')).length >= 10);

for (const file of sources) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  ok(`${file} never advises the max timeout`, !ADVISES_LONGEST.test(text));
  ok(`${file} names no timeout over ${MAX_TOOL_TIMEOUT_MS} ms`, overCeiling(text).length === 0);
}

ok('negative control: "max timeout" is caught', ADVISES_LONGEST.test('run it with the max timeout'));
ok('negative control: 600000 ms is caught', overCeiling('set timeout 600000 ms').length === 1);
ok('negative control: 320 s is caught', overCeiling('a timeout of 320 s').length === 1);
ok('negative control: 290000 ms passes', overCeiling('timeout 290000 ms').length === 0);

done();
