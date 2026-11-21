// bare-id-gate (KIT-T1462): a closing reply that carries ticket, decision, lever or run ids, or pastes a list of ids, draws
// a warning (exit 0, stderr); a reply that names the thing by what it does, a commit hash in the landing receipt, code,
// quoted text and a subagent's report draw none. Run: node hooks/bare-id-gate.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { bareIdReport } from './lib/bare-ids.mjs';

const { ok, done } = reporter('bare-id-gate');
const GATE = 'bare-id-gate.mjs';
const RUN = `${process.pid}-${Date.now()}`;
const dir = tmpDir('bare-id-');

let n = 0;
const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const turn = (reply) => {
  const file = join(dir, `t${n++}.jsonl`);
  writeFileSync(file, [entry('user', 'Carry on.'), entry('assistant', [{ type: 'text', text: reply }])].join('\n'));
  return file;
};

const FLAGGED = [
  ['a ticket id alone', 'The lane host now caches its output. Done under KIT-T1462.'],
  ['a decision id in brackets after the words', 'The lane host now caches its output (RDG-D146).'],
  ['a lever id', 'Lever TH-73 cut the startup hold.'],
  ['a run id', 'The probe run-2026-11-21-a held 12 s at the loading screen.'],
  ['a decision id at the start', 'RDG-D148 says to drop ids from replies.'],
  ['a pasted list of commit-hash shaped agent ids', 'Agents: a9ac8af0ce22e4a68, a1b2c3d4e5f6a7b89, a0f9e8d7c6b5a4f33'],
  ['a pasted list of run ids', 'run-2026-11-20-a run-2026-11-20-b run-2026-11-21-a'],
];
const PASSING = [
  ['the thing named by what it does', 'The lane host now caches its output on disk, so the second start skips the cook.'],
  ['a commit hash in the receipt line after the words', 'The lane host now caches its output.\n\n  9677c2bc prose-ask matcher | no ticket cited | pushed'],
  ['a receipt commit line that cites ticket ids', 'The lane host now caches its output.\n\n  9677c2bc prose-ask matcher | KIT-T1459, KIT-T1460 | pushed'],
  ['an id inside inline code', 'Run `t status KIT-T1462 review` to close it.'],
  ['an id inside a code fence', 'Output:\n```\nKIT-T1462 review\nRDG-D146\n```\nDone.'],
  ['an id in quoted words', 'He wrote "RDG-D148 is the ruling" so I dropped ids.'],
  ['an id in a blockquote', '> RDG-D148 is the ruling\n\nI dropped ids.'],
  ['UTF-8 and SHA-256 names', 'The export is UTF-8 and the checksum is SHA-256.'],
  ['a word that is hex letters only', 'The decade of defaced pages ended.'],
  ['a plain count and a date', 'Landed 12 files on 2026-11-21 in 4 steps.'],
];

try {
  for (const [name, reply] of FLAGGED) ok(`matcher flags: ${name}`, bareIdReport(reply).flagged);
  for (const [name, reply] of PASSING) ok(`matcher passes: ${name}`, !bareIdReport(reply).flagged);
  ok('the matcher names the ids it found', bareIdReport('Done under KIT-T1462 and RDG-D146.').ids.join(',') === 'KIT-T1462,RDG-D146');
  ok('the matcher reads the pasted list line', bareIdReport(FLAGGED[5][1]).pastedList?.includes('a9ac8af0ce22e4a68'));

  const d = adopted(false);
  let s = 0;
  const stop = (reply, extra = {}) => hook(GATE, { hook_event_name: 'Stop', session_id: `s${RUN}-${s++}`, transcript_path: turn(reply), ...extra }, d);
  for (const [name, reply] of FLAGGED) {
    const r = stop(reply);
    ok(`gate warns, exit 0, names the rule: ${name}`, r.code === 0 && r.out.includes('Name the thing by') && r.out.includes('id: bare-ids'));
  }
  const warned = stop(FLAGGED[1][1]);
  ok('the warning names the id and says commit hashes belong in the receipt', warned.out.includes('RDG-D146') && warned.out.includes('only in the landing receipt'));
  ok('the warning says it is not a block', warned.code === 0 && warned.out.includes('a warning, not a block'));
  for (const [name, reply] of PASSING) ok(`gate is silent: ${name}`, stop(reply).code === 0 && !stop(reply).out.includes('bare-ids'));
  ok('a subagent report is exempt', !stop(FLAGGED[0][1], { agent_id: 'agent-1', agent_type: 'implementer' }).out.includes('bare-ids'));
  ok('last_assistant_message is read when the payload carries it', stop('Done.', { last_assistant_message: FLAGGED[1][1] }).out.includes('RDG-D146'));
  const marked = stop('Landed.\n// claude-kit-ignore-line bare-ids\nThe fix is RDG-D146.');
  ok('an in-source marker line is not read', !marked.out.includes('bare-ids'));
} finally {
  cleanup();
}
done();
