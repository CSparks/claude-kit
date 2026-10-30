// What an agent's context is made of (KIT-D116): shares by source, repeated task output as its own category, the five biggest
// tool results, the "mostly garbage input" verdict with its fix, and the line riding the ceiling flag.
// Run: node hooks/context-breakdown.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';
import { breakdownLine, contextBreakdown, SOURCE } from './lib/context-breakdown.mjs';
import { ceilingFlag } from './lib/agent-context.mjs';

const { ok, done } = reporter('context-breakdown');
const dir = tmpDir('breakdown-');
const WALL = 1500;
const KB = 'x'.repeat(4000);

let n = 0;
const user = (content) => ({ type: 'user', message: { role: 'user', content } });
const assistant = (content) => ({ type: 'assistant', message: { id: `m${n++}`, role: 'assistant', content, usage: { input_tokens: 1, output_tokens: 1 } } });
const call = (name, input) => { const id = `t${n++}`; return { id, block: { type: 'tool_use', id, name, input } }; };
const result = (id, text) => user([{ type: 'tool_result', tool_use_id: id, content: text }]);

// An agent that read one big file twice, ran a cargo test with a Compiling wall and an error, and polled the broker.
function garbageRows() {
  const rows = [user('Fix DE-T1: brief text.')];
  const read = call('Read', { file_path: '/repo/big.rs' });
  const reread = call('Read', { file_path: '/repo/big.rs' });
  const test = call('Bash', { command: 'cargo test -p game' });
  const wait = call('Bash', { command: 'node wait.mjs j-1 --root /repo' });
  const wall = Array.from({ length: WALL }, (_, i) => `   Compiling dep-${i} v1.${i}.0`).join('\n');
  rows.push(assistant([{ type: 'text', text: 'Reading the file.' }, read.block]), result(read.id, KB.repeat(3)));
  rows.push(assistant([reread.block]), result(reread.id, KB.repeat(3)));
  rows.push(assistant([test.block]), result(test.id, `${wall}\nerror[E0308]: mismatched types\n`));
  rows.push(assistant([wait.block]), result(wait.id, Array.from({ length: 200 }, () => 'wait: j-1 queued at position 3 of 5').join('\n')));
  return rows;
}

// An agent that mostly reasons and reads ranges and q results.
function healthyRows() {
  const rows = [user('Fix DE-T2: brief text.')];
  for (let i = 0; i < 4; i++) {
    const read = call('Read', { file_path: `/repo/f${i}.rs`, offset: 10, limit: 40 });
    const q = call('Bash', { command: 'node q.mjs code foo' });
    rows.push(assistant([{ type: 'text', text: `step ${i} `.repeat(400) }, read.block, q.block]));
    rows.push(result(read.id, `line ${i}\n`.repeat(100)), result(q.id, `hit ${i}\n`.repeat(100)));
  }
  return rows;
}

const write = (name, rows) => {
  const file = join(dir, name);
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return file;
};

try {
  const bad = write('garbage.jsonl', garbageRows());
  const b = contextBreakdown(bad);
  ok('repeated task output is its own category, the largest here', Object.entries(b.shares).sort((x, y) => y[1] - x[1])[0][0] === SOURCE.REPEAT);
  ok('the second read of a file is a re-read; the first stays a whole-file read', b.shares[SOURCE.RE_READ] > 0 && b.shares[SOURCE.WHOLE_READ] > 0);
  ok('the brief is counted', b.shares[SOURCE.BRIEF] > 0);
  ok('agent reasoning and text is counted', b.shares[SOURCE.AGENT] > 0);
  ok('the five biggest single results are named with sizes, largest first', b.top.length === 4 && b.top[0].label.startsWith('Bash cargo test') && b.top[0].tokens >= b.top[1].tokens);
  ok('bulk tool output is the majority, so the agent is mostly garbage input', b.garbage > 0.5);
  const line = breakdownLine(bad, 280000, 'agent-1');
  ok('the line names the agent, its size, the share by source and the top results', /^agent agent-1 at 280k: \d+% repeated task output/.test(line) && line.includes('top: Bash cargo test'));
  ok('the line says MOSTLY GARBAGE INPUT with a fix', line.includes('MOSTLY GARBAGE INPUT') && line.includes('result-summary.mjs'));
  const failing = call('Bash', { command: 'cargo test' });
  const errors = contextBreakdown(write('errors.jsonl', [user('brief'), assistant([failing.block]), result(failing.id, Array.from({ length: 300 }, () => 'error: boom').join('\n'))]));
  ok('negative: a repeated real error line is never counted as repeated output', !errors.shares[SOURCE.REPEAT] && errors.shares[SOURCE.TEST_LOG] > 0);

  const good = write('healthy.jsonl', healthyRows());
  const g = contextBreakdown(good);
  ok('negative: reasoning, ranged reads and q results are not garbage', g.garbage < 0.5 && !breakdownLine(good, 280000, 'agent-2').includes('MOSTLY GARBAGE'));
  ok('negative: an unreadable or empty transcript gives no line', breakdownLine(join(dir, 'nope.jsonl'), 280000, 'x') === '' && breakdownLine(write('empty.jsonl', []), 280000, 'x') === '');

  const flagged = ceilingFlag({ id: 'agent-1', status: 'done', tokens: 450000, tickets: ['KIT-T1'], transcript: bad });
  ok('the ceiling flag carries the composition line', flagged.includes('Composition: agent agent-1 at 450k') && flagged.includes('MOSTLY GARBAGE INPUT'));
  ok('negative: a past-ceiling row with no transcript keeps the plain flag', !ceilingFlag({ id: 'a', status: 'done', tokens: 450000 }).includes('Composition'));
} finally {
  cleanup();
}
done();
