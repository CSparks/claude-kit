// request-gate routing (KIT-T927; closes KIT-T385, KIT-T808, KIT-T655, KIT-T360): a request is routed when the
// turn ran cap, a t item verb (new, request, note, question, comment, criterion, decide), or dispatched an agent
// whose prompt carries the maintainer's words; a message answered once is never nudged again at a later Stop.
// Run: node hooks/request-gate-routing.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./request-gate.mjs', import.meta.url));
const STORES = ['inbox', 'tickets', 'decisions', 'questions', 'notes'];
const REGISTRY = join(mkdtempSync(join(tmpdir(), 'rgr-reg-')), 'registry.json');
const ENV = { ...process.env, CLAUDE_KIT_REGISTRY: REGISTRY };
const REQUEST = 'There needs to be a wider lane for the drum pads, they feel cramped.';
let failures = 0;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'rgr-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const s of STORES) mkdirSync(join(dir, '.ai', s), { recursive: true });
  return dir;
}

const bash = (command) => ({ type: 'tool_use', name: 'Bash', input: { command } });
const agent = (prompt) => ({ type: 'tool_use', name: 'Agent', input: { prompt, description: 'x' } });

function transcript(dir, { user = REQUEST, blocks = [], ts = '2026-01-01T00:00:00.000Z' } = {}) {
  const file = join(dir, 'transcript.jsonl');
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: user }, timestamp: ts }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Working on it.' }, ...blocks] } }),
  ].join('\n') + '\n');
  return file;
}

function stop(dir, file) {
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, input: JSON.stringify({ transcript_path: file }), encoding: 'utf8', env: ENV });
  return r.status;
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

const withBlocks = (blocks, user) => { const d = repo(); return stop(d, transcript(d, { blocks, user })); };

expect('control: an un-captured request blocks', withBlocks([bash('git status --short')]), 2);

for (const cmd of [
  't comment GG-T195 "Chris: the depth of options needs to be planned out" --author claude',
  't criterion GG-T195 "options depth is planned"',
  't new feature "wider drum pad lane"',
  't request "wider drum pad lane"',
  't note "wider drum pad lane"',
  't question "how wide?"',
  't decide --file draft.md',
  'node "C:/kit/scripts/t.mjs" --root D:/dev/p comment GG-T195 "wider lane"',
  'node /k/scripts/t.mjs notes GG-T195 "wider lane"',
  'cap bug wider drum pad lane',
  'node /k/scripts/cap.mjs --project hod feature wider lane',
  'cd /d/dev/p && t comment GG-T195 "wider lane" | tail -1',
]) expect(`routed by: ${cmd.slice(0, 60)}`, withBlocks([bash(cmd)]), 0);

expect('routed by a dispatch whose prompt carries the [maintainer-words: ...] token',
  withBlocks([agent('Plan it. [maintainer-words: "wider lane"] Search with q.')]), 0);
expect('routed by a dispatch whose prompt quotes six consecutive words of the request',
  withBlocks([agent('Chris said: "there needs to be a wider lane for the drum pads". Plan the options.')]), 0);

expect('control: t status is not a capture', withBlocks([bash('t status GG-T195 review')]), 2);
expect('control: t comment named inside an echo is not a capture', withBlocks([bash('echo t comment GG-T195 x')]), 2);
expect('control: a dispatch that does not cite the maintainer is not a capture', withBlocks([agent('Run the pad tests and report counts.')]), 2);
expect('control: three words of the request in a prompt are not enough', withBlocks([agent('Check the drum pads wider lane tests.')]), 2);

{
  const d = repo();
  expect('first Stop: routed by t comment', stop(d, transcript(d, { blocks: [bash('t comment GG-T195 "wider lane"')] })), 0);
  expect('a later Stop on the SAME message with no routing in view is not re-fired (KIT-T360)', stop(d, transcript(d, { blocks: [bash('git status')] })), 0);
  expect('control: a different un-captured request still blocks', stop(d, transcript(d, { user: 'We should add a second row of pads for fills.', ts: '2026-01-01T01:00:00.000Z', blocks: [bash('git status')] })), 2);
}

console.log(failures ? `\n${failures} FAILED` : '\nall pass');
process.exit(failures ? 1 : 0);
