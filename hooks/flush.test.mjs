// Tests for the SESSION-cited artifact check in hooks/flush.mjs (KIT-T215): an existing
// cited path is silent, a missing one warns (never blocks), and an unadopted repo no-ops.
// Run: node hooks/flush.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { citedPaths } from './session-citations.mjs';
import { stampAsk } from '../scripts/question-asks.mjs';

const HOOK = fileURLToPath(new URL('./flush.mjs', import.meta.url));
let failures = 0;
let count = 0;

function ok(name, cond) {
  count++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

function makeRepo({ adopt = true, session = null, files = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'flush-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  if (session !== null) writeFileSync(join(dir, '.ai', 'SESSION.md'), session);
  return dir;
}

// The registry is isolated per run: flush now falls back to the UNBOUNDED store when no .ai is
// above the cwd (KIT-T189), so the machine's real store must never leak into these fixtures.
const NO_REGISTRY = join(tmpdir(), 'no-registry-for-flush-test.json');

function run(dir, unbounded = '') {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: 'PreCompact' }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: NO_REGISTRY, CLAUDE_KIT_UNBOUNDED_AI: unbounded },
  });
  return { code: r.status, err: r.stderr || '', out: r.stdout || '' };
}

// --- unit: what counts as a citation -------------------------------------------------
ok('citedPaths: picks up a relative path with an extension', citedPaths('see scratchpad/x.md now').includes('scratchpad/x.md'));
ok('citedPaths: ignores a bare dotted word', citedPaths('flushed SESSION.md today').length === 0);
ok('citedPaths: ignores URLs', citedPaths('https://example.com/a/b.md').length === 0);
ok('citedPaths: ignores globs', citedPaths('touched src/**/*.mjs').length === 0);

// --- existing citation -> silent -----------------------------------------------------
const good = makeRepo({ session: 'Deliverable: docs/research/harvest.md\n', files: { 'docs/research/harvest.md': 'x' } });
const rGood = run(good);
ok('existing cited path: no warning', !/do NOT exist/.test(rGood.err));
ok('existing cited path: exits 0', rGood.code === 0);

// --- missing citation -> warn, never block -------------------------------------------
const bad = makeRepo({ session: 'Deliverable: scratchpad/recipe-model-harvest.md\n' });
const rBad = run(bad);
ok('missing cited path: warns', /do NOT exist/.test(rBad.err));
ok('missing cited path: names the path', /scratchpad\/recipe-model-harvest\.md/.test(rBad.err));
ok('missing cited path: still exits 0 (warn, never block)', rBad.code === 0);

// --- unadopted repo -> no-op ---------------------------------------------------------
const none = makeRepo({ adopt: false });
const rNone = run(none);
ok('unadopted repo, no unbounded store: silent', !/do NOT exist/.test(rNone.err) && rNone.out === '');

// --- unadopted repo + an unbounded store -> flush the CATCH-ALL instead (KIT-T189) -----
const unboundedAi = join(mkdtempSync(join(tmpdir(), 'flush-unb-')), 'unbounded', '.ai');
mkdirSync(join(unboundedAi, 'inbox'), { recursive: true });
writeFileSync(join(unboundedAi, 'config.yml'), 'ids:\n  key: \"UNB\"\n');
const rUnb = run(makeRepo({ adopt: false }), unboundedAi);
ok('unadopted repo with an unbounded store: flushes the catch-all', /COMPACTION IMMINENT/.test(rUnb.out));
ok('the reminder points at the unbounded store', rUnb.out.includes(unboundedAi));
ok('unadopted repo: exits 0', rNone.code === 0);

// --- the PreCompact reminder itself --------------------------------------------------
const reminder = run(makeRepo({ session: '# SESSION\n' }));
ok('adopted repo emits the flush reminder', /COMPACTION|flush/i.test(reminder.out + reminder.err));
ok('the reminder names the append-safe form and never offers a bare replace (KIT-T521)',
  /deletes nothing/.test(reminder.out) && /--replace --file/.test(reminder.out) && !/t session --file <draft\.md> \(writes/.test(reminder.out));

// --- Stop: the unresolved-question nag (KIT-T448) -------------------------------------
const TODAY = new Date().toISOString().slice(0, 10);
const question = (id, status, resolution = '<answer>') => `---\nid: ${id}\nstatus: ${status}\n---\n\n**Q:** Burrow?\n\n**Resolution:** ${resolution}\n`;
function runStop(dir, session) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir, input: JSON.stringify({ hook_event_name: 'Stop', session_id: session }), encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: NO_REGISTRY, CLAUDE_KIT_UNBOUNDED_AI: '' },
  });
  return { code: r.status, err: r.stderr || '' };
}
const asks = stampAsk(question('FQF-Q001', 'todo'), 'me', `${TODAY} 09:00`);
const stale = stampAsk(question('FQF-Q002', 'todo'), 'me', '2020-01-01 09:00');
const answered = stampAsk(question('FQF-Q003', 'resolved', '(2026-10-13, pat) yes'), 'me', `${TODAY} 09:00`);
const theirs = stampAsk(question('FQF-Q004', 'todo'), 'them', `${TODAY} 09:00`);
const qrepo = makeRepo({ files: {
  '.ai/questions/FQF-Q001-a.md': asks, '.ai/questions/FQF-Q002-b.md': stale,
  '.ai/questions/FQF-Q003-c.md': answered, '.ai/questions/FQF-Q004-d.md': theirs,
} });
const nag = runStop(qrepo, 'me');
ok('Stop warns about this session\'s unresolved ask stamped today', nag.err.includes('FQF-Q001') && nag.err.includes('t resolve FQF-Q001'));
ok('Stop stays quiet about a stale ask, a resolved one and another session\'s', !/FQF-Q00[234]/.test(nag.err));
ok('Stop never blocks on the question nag', nag.code === 0);
ok('another session gets no nag for this session\'s ask', !runStop(qrepo, 'someone-else').err.includes('FQF-Q001'));

console.log(`\n${count - failures}/${count} passed`);
process.exit(failures ? 1 : 0);
