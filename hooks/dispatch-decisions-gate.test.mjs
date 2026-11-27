// brief-decisions on gate briefs (KIT-T1607): a brief of any job that names a path under hooks/ (or a [paths: hooks] tag), or a
// ticket on a named kit gate, is matched against the recorded decisions too, so a ruling on gate changes is named before
// dispatch. The case is a fix brief on the push gate after the store ruled that gate changes following a cd are reverted.
// Run: node hooks/dispatch-decisions-gate.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, finish, makeRepo, run, transcript } from './dispatch-guard-harness.mjs';
import { writeDecisions } from './question-gates-fixture.mjs';
import { touchesGate } from './dispatch-decisions.mjs';

const RULING_ID = 'FQD-D191';
const RULING_TITLE = 'Gate relaxations that follow a cd inside a command are reverted; the gates refuse anything unclear until the shell lexer rewrite';
const RULING = `---\nid: ${RULING_ID}\ntitle: ${RULING_TITLE}\nsummary: ${RULING_TITLE}\ndate: 2026-11-25\nsupersedes: \nsource: \n---\n\n**Decision:** Every gate change that follows a cd, Set-Location or pushd inside a command is reverted; the gates refuse an unclear command until the shell lexer rewrite lands whole.\n`;

const repo = writeDecisions(makeRepo());
writeFileSync(join(repo, '.ai', 'decisions', 'FQD-D191-gate-relaxations.md'), RULING);
const tx = transcript(repo, 'sonnet-session', 'claude-sonnet-5-5');

const FIX_BRIEF = 'Fix the push gate in hooks/upstream-gate.mjs: a command that runs Set-Location into another repo, then git push, is judged against the session cd. Make the gate follow the cd, Set-Location and pushd inside the command before the push, so the relaxation of the refusal judges the repo the command reached; refuse when the lexer cannot read the command.';
const TICKET_BRIEF = 'KIT-T1601, upstream-gate: a command that runs Set-Location into another repo, then git push, is judged against the session cd. Make the gate follow the cd, Set-Location and pushd inside the command before the push, so the relaxation of the refusal judges the repo the command reached; refuse when the lexer cannot read the command.';
const PLAIN_BRIEF = 'Fix the road junction mesh so a kerb return meets the footway without a gap, and add a test for the four-way junction.';
const fix = (prompt) => run(repo, { subagent_type: 'claude-kit:implementer', model: 'sonnet', prompt: `[job: fix] ${prompt}`, jobless: true }, tx);

const blocked = fix(FIX_BRIEF);
expect('a fix brief naming a hooks/ gate file that overlaps the ruling is blocked, naming it', blocked.code === 2 && /brief-decisions/.test(blocked.err) && blocked.err.includes(RULING_ID) ? 1 : 0, 1);
expect('a fix brief citing a ticket on a named gate is judged the same way', fix(TICKET_BRIEF).code, 2);
expect('a [paths: hooks] tag makes it a gate brief too', fix(`[paths: hooks] ${FIX_BRIEF.replace('hooks/upstream-gate.mjs', 'the push check')}`).code, 2);
expect('naming the ruling clears it', fix(`${FIX_BRIEF} [rulings-checked: ${RULING_ID} governs: no cd following]`).code, 0);
expect('negative control: a fix brief that touches no gate is not judged', fix(PLAIN_BRIEF).code, 0);
expect('negative control: the same push brief with no gate path, gate name or hooks tag is not judged', fix(FIX_BRIEF.replace(' in hooks/upstream-gate.mjs', '')).code, 0);
expect('touchesGate reads a hooks path, a hooks tag, and a ticket beside a gate name', [touchesGate('edit hooks/lib/upstream-policy.mjs'), touchesGate('[paths: hooks]'), touchesGate('KIT-T1593 source-shell-gate'), !touchesGate('KIT-T1593 the stash remedy'), !touchesGate('the push gate')].every(Boolean) ? 1 : 0, 1);

finish();
