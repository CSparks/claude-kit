#!/usr/bin/env node
// receipt-note.test.mjs — the receipt note (KIT-T1221): commits landed this turn reach the main thread, once, right after
// the hand-back or the shell call that moved history, before it writes its closing reply.
// Run: node hooks/receipt-note.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./receipt-note.mjs', import.meta.url));
const TURN_AGE_MS = 60000;
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rn-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
  return dir;
}

function commit(dir, file, message) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), `export const v = '${message}';\n`);
  execFileSync('git', ['add', file], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: dir });
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

function transcript(dir, assistantReplies = []) {
  const file = join(dir, 'transcript.jsonl');
  const user = { type: 'user', message: { role: 'user', content: 'land it' }, timestamp: new Date(Date.now() - TURN_AGE_MS).toISOString() };
  const replies = assistantReplies.map((text) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } }));
  writeFileSync(file, [user, ...replies].map((e) => JSON.stringify(e)).join('\n') + '\n');
  return file;
}

const state = mkdtempSync(join(tmpdir(), 'rn-state-'));
const call = (dir, tx, extra) => {
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_TURN_STATE: state }, input: JSON.stringify({ session_id: 'S1', transcript_path: tx, tool_name: 'Agent', tool_input: {}, ...extra }) });
  const note = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
  return { code: r.status, text: note?.additionalContext || '', event: note?.hookEventName };
};
const commitCall = (command) => ({ tool_name: 'Bash', tool_input: { command } });

{
  const dir = makeRepo();
  const tx = transcript(dir);
  const first = commit(dir, 'src/a.mjs', 'first change HOD-T001');
  const second = commit(dir, 'src/b.mjs', 'second change HOD-T002');
  const handBack = call(dir, tx);
  check('a subagent hand-back lists every commit landed this turn, with its ticket and push state', handBack.code === 0 && handBack.event === 'PostToolUse' && handBack.text.includes(first) && handBack.text.includes(second) && /HOD-T001/.test(handBack.text) && /local only/.test(handBack.text), handBack.text);
  check('the note is one compact block that ends in the fill line', handBack.text.startsWith('RECEIPT (KIT-T1221): 2 commit(s)') && handBack.text.trimEnd().split('\n').at(-1).startsWith('UAT / no-test'));
  check('a second hand-back with nothing new is silent', call(dir, tx).text === '');
  const third = commit(dir, 'src/c.mjs', 'third change HOD-T003');
  check('a shell call that is no history move stays silent although a commit is unshown', call(dir, tx, commitCall('ls -la')).text === '');
  const afterCommit = call(dir, tx, commitCall('git commit -m "third change HOD-T003"'));
  check('a shell git commit lists only the commit not shown before', afterCommit.text.includes(third) && !afterCommit.text.includes(first) && afterCommit.text.startsWith('RECEIPT (KIT-T1221): 1 commit(s)'), afterCommit.text);
  check('a subagent call (agent_id set) gets no note', call(dir, tx, { agent_id: 'a1b2c3', tool_name: 'Bash', tool_input: { command: 'git push' } }).text === '');
}

{
  const dir = makeRepo();
  const named = commit(dir, 'src/a.mjs', 'named change HOD-T001');
  const unnamed = commit(dir, 'src/b.mjs', 'unnamed change HOD-T002');
  const tx = transcript(dir, [`Landed ${named} earlier.`, 'Working on the next one.']);
  const note = call(dir, tx);
  check('a commit an earlier reply already named by sha is left out', note.text.includes(unnamed) && !note.text.includes(named), note.text);
}

{
  const dir = makeRepo();
  const tx = transcript(dir);
  check('nothing landed: silent', call(dir, tx).text === '');
  commit(dir, 'docs/readme.md', 'notes only');
  check('control: a docs-only commit citing no ticket is no landing', call(dir, tx).text === '');
  const plain = makeRepo({ adopt: false });
  commit(plain, 'src/a.mjs', 'change HOD-T001');
  check('an unadopted repo is silent', call(plain, transcript(plain)).text === '');
  check('a missing transcript is silent', call(dir, join(dir, 'absent.jsonl')).text === '');
  check('fail-open: a malformed payload exits 0', spawnSync(process.execPath, [HOOK], { cwd: dir, input: 'not json', encoding: 'utf8' }).status === 0);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
