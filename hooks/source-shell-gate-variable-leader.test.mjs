#!/usr/bin/env node
// source-shell-gate-variable-leader.test.mjs — a kit call whose command word is a variable the command itself assigns
// (`T="node $HOME/.../t.mjs"; $T session "..."`) is judged like the kit call typed alone: its quoted arguments are data
// (KIT-T1336). A block names the exact word it matched.
// Run: node hooks/source-shell-gate-variable-leader.test.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { shellSourceWrites } from './lib/shell-source-write.mjs';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};
const hits = (command) => shellSourceWrites(command, { shell: 'bash' });
const allows = (name, command) => check(`allows ${name}`, hits(command).length === 0, JSON.stringify(hits(command)));
const blocks = (name, command) => check(`blocks ${name}`, hits(command).length > 0, command);

const T_VALUE = 'T="node $HOME/.claude/claude-kit-runtime/current/scripts/t.mjs"';
const FIX = (old, now) => `$T session --fix "${old}" "${now}" --all 2>&1 | tail -1`;
const APPEND = '$T session "docs/perf/city-survives-crests-2026-11-16.md is stale: deleted on purpose (the City road-search work was stopped; copy saved in target/coord/city-writer-wip/)" --append 2>&1 | tail -1';
const REPORTED = [
  `cd /d/dev/road-generator && ${T_VALUE}; ${FIX('look/model.rs', 'rapid-game/rust/engine/rg-graphics/src/look/model.rs')}`,
  ...['a', 'b', 'c', 'd', 'e', 'f'].map((n) => FIX(`${n}/old.rs`, `rapid-game/${n}/new.rs`)),
  APPEND,
].join('; ');

allows('the reported chain of t session calls behind a T variable', REPORTED);
allows('the append alone behind the T variable', `${T_VALUE}; ${APPEND}`);
allows('a braced variable leader', `${T_VALUE}; \${T} session "copy saved in a/b/" --append`);
allows('a variable holding a bare kit verb', 'Q=q; $Q code "rm src/a.rs" --path src/a.rs');
allows('a variable leader after an env assignment', `${T_VALUE}; FOO=1 $T session "copy saved in a/b/" --append`);

blocks('a variable that holds a copy word', 'C=cp; $C src/a.rs src/b.rs');
blocks('a variable holding node and a kit script name used for a redirect into a source file', `${T_VALUE}; $T session "x" > src/a.rs`);
blocks('a variable leader that is assigned twice', `${T_VALUE}; T=rm; $T session "copy saved in a/b/"`);
blocks('a variable leader nothing assigns', '$T session "copy saved in a/b/"');
blocks('a variable leader assigned behind a pipe', `echo | ${T_VALUE}; $T session "x" > src/a.rs`);
blocks('a variable leader assigned in the background', 'Q=q & $Q code x > src/a.rs');
blocks('the copy alias outside any kit call', 'copy saved in target/coord/w/');

const found = hits('copy saved in target/coord/w/');
check('a hit carries the word it matched', found.length > 0 && found.every((h) => h.token === 'copy'), JSON.stringify(found));

const run = (command) => {
  const r = spawnSync(process.execPath, [HOOK], { cwd: process.cwd(), input: JSON.stringify({ session_id: 'S1', tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}` };
};
const blocked = run('copy saved in target/coord/w/');
check('the block text names the matched word', blocked.code === 2 && blocked.text.includes('the word `copy`'), blocked.text.trim());

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
