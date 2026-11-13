// Tests for the SESSION-cited artifact check in hooks/flush.mjs (KIT-T215): an existing
// cited path is silent, a missing one warns (never blocks), and an unadopted repo no-ops.
// Also the Stop anchor nudge and the landing notes it writes first (KIT-T1150).
// Run: node hooks/flush.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
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
ok('citedPaths: ignores an absolute POSIX host path', citedPaths('env at /srv/showtimewarp/.env today').length === 0);
ok('citedPaths: ignores a ~/ home path', citedPaths('see ~/.claude/settings.json').length === 0);
ok('citedPaths: does not truncate a long extension into a path', citedPaths('keys in infra/.secrets here').length === 0);
ok('citedPaths: still reports a repo-relative path beside host paths', citedPaths('/srv/a/.env and docs/missing.md').join() === 'docs/missing.md');
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

// --- citations into another project's tree are not this anchor's to fix -------------------
const foreignRepo = makeRepo({ session: 'Plan lives in D:\\dev\\other-project\\docs\\plan.md and docs/own-missing.md\n' });
const rForeign = run(foreignRepo);
ok('absolute path outside the repo is not reported', !/other-project/.test(rForeign.err));
ok('a missing in-repo path beside it is still reported', /docs\/own-missing\.md/.test(rForeign.err));

// --- Stop anchor nag: bookkeeping-only turns stay silent (KIT-D126) -----------------------
const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, stdio: 'ignore' });

// Starts a turn a minute ago, writes `files`, makes the anchor stale, commits as `author`.
function landInTurn(dir, files, { subject = 'work', author = 't' } = {}) {
  const turnStart = new Date(Date.now() - 60_000);
  const tx = join(mkdtempSync(join(tmpdir(), 'flush-tx-')), 'transcript.jsonl');
  writeFileSync(tx, JSON.stringify({ type: 'user', timestamp: turnStart.toISOString(), message: { role: 'user', content: 'go' } }) + '\n');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  const longAgo = new Date(Date.now() - 600_000);
  utimesSync(join(dir, '.ai', 'SESSION.md'), longAgo, longAgo);
  git(dir, ['add', '-A']);
  git(dir, ['-c', `user.name=${author}`, 'commit', '-qm', subject]);
  return tx;
}
function stopOn(dir, tx) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir, input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's', transcript_path: tx }), encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: NO_REGISTRY, CLAUDE_KIT_UNBOUNDED_AI: '' },
  });
  return { code: r.status, err: r.stderr || '' };
}
const runStopWithTurn = (dir, files, opts) => stopOn(dir, landInTurn(dir, files, opts));
const anchorOf = (dir) => readFileSync(join(dir, '.ai', 'SESSION.md'), 'utf8');
const landedLines = (dir) => anchorOf(dir).split('\n').filter((l) => /\blanded [\w/@-]*[0-9a-f]{7} /.test(l));

const bookkeeping = runStopWithTurn(makeRepo({ session: '# S\n' }), { '.ai/tickets/X-T001-a.md': '---\nid: X-T001\n---\n' });
ok('a commit that only changes .ai tickets does not nag', bookkeeping.code === 0 && !/resume anchor/.test(bookkeeping.err));
const bookkeepingRepo = makeRepo({ session: '# S\n' });
runStopWithTurn(bookkeepingRepo, { '.ai/tickets/X-T001-a.md': '---\nid: X-T001\n---\n' });
ok('a commit that only changes .ai tickets is not noted in the anchor', landedLines(bookkeepingRepo).length === 0);

// --- Stop: a landed commit is noted in the anchor and counts as a touch (KIT-T1150) -----------
const noted = makeRepo({ session: '# S\n\n## Now\n\n- [2026-01-01 00:00] earlier entry\n' });
const notedTx = landInTurn(noted, { 'src/app.mjs': 'export {};\n' }, { subject: 'add app (implements ZZ-T001, ZZ-T002)', author: 'subagent' });
const notedRun = stopOn(noted, notedTx);
ok('a commit that changes project files, made by another author, is noted and does not nag', notedRun.code === 0 && !/resume anchor/.test(notedRun.err));
ok('the note is one dated line: short sha, subject, ticket ids, push state', landedLines(noted).length === 1
  && /^- \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] landed [0-9a-f]{7} add app \(implements ZZ-T001, ZZ-T002\) \(ZZ-T001, ZZ-T002\): local only \(no remote\)$/.test(landedLines(noted)[0]));
ok('the note adds to the anchor: earlier lines are kept, the note sits under the top section', anchorOf(noted).includes('earlier entry') && anchorOf(noted).indexOf('landed') < anchorOf(noted).indexOf('earlier entry'));
stopOn(noted, notedTx);
ok('the same sha twice adds one line', landedLines(noted).length === 1);
ok('a second commit adds a second line, the first stays', (() => {
  const tx = landInTurn(noted, { 'src/b.mjs': 'export {};\n' }, { subject: 'add b' });
  stopOn(noted, tx);
  return landedLines(noted).length === 2;
})());
ok('a commit the broker already noted (broker landed <sha>) is not noted again', (() => {
  const dir = makeRepo({ session: '# S\n' });
  const tx = landInTurn(dir, { 'src/c.mjs': 'export {};\n' }, { subject: 'broker work' });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  writeFileSync(join(dir, '.ai', 'SESSION.md'), `# S\n\n- [2026-11-13 10:00] broker landed ${sha.slice(0, 10)} ZZ-T003 broker work\n`);
  const longAgo = new Date(Date.now() - 600_000);
  utimesSync(join(dir, '.ai', 'SESSION.md'), longAgo, longAgo);
  const r = stopOn(dir, tx);
  return landedLines(dir).length === 1 && /broker landed/.test(landedLines(dir)[0]) && r.code === 0;
})());
ok('the anchor backup folder is untouched by notes', !existsSync(join(noted, '.ai', '.session-backups')));

const withDecision = makeRepo({ session: '# S\n' });
const decisionRun = runStopWithTurn(withDecision, { 'src/app.mjs': 'export {};\n', '.ai/decisions/ZZ-D001-x.md': '---\nid: ZZ-D001\n---\n' });
ok('control: a commit plus a decision edit with a stale anchor still nags for a real t session', decisionRun.code === 2 && /resume anchor/.test(decisionRun.err) && /decisions edit/.test(decisionRun.err));
ok('control: the nag states the rule: every commit, landing receipt and decision, before replying', /every commit, landing receipt and decision, the same turn, before replying/.test(decisionRun.err) && /t session "<state \+ next steps>"/.test(decisionRun.err));
ok('the commit is still noted when the nag fires', landedLines(withDecision).length === 1);

const unadopted = makeRepo({ adopt: false });
writeFileSync(join(unadopted, 'a.mjs'), 'export {};\n');
git(unadopted, ['add', '-A']);
git(unadopted, ['commit', '-qm', 'x']);
const unadoptedTx = join(mkdtempSync(join(tmpdir(), 'flush-tx-')), 'transcript.jsonl');
writeFileSync(unadoptedTx, JSON.stringify({ type: 'user', timestamp: new Date(Date.now() - 60_000).toISOString(), message: { role: 'user', content: 'go' } }) + '\n');
const unadoptedRun = stopOn(unadopted, unadoptedTx);
ok('a repo without .ai is untouched by a landing', unadoptedRun.code === 0 && !existsSync(join(unadopted, '.ai')));

const unwritable = makeRepo({ session: null });
mkdirSync(join(unwritable, '.ai', 'SESSION.md'));
const unwritableRun = runStopWithTurn(unwritable, { 'src/app.mjs': 'export {};\n' });
ok('an unwritable anchor does not crash the hook and the Stop check still nags', unwritableRun.code === 2 && /resume anchor/.test(unwritableRun.err) && !/TypeError|EISDIR|at .*\.mjs:\d+/.test(unwritableRun.err));

const sub = makeRepo({ adopt: false, files: { 'lib.mjs': 'export {};\n' } });
git(sub, ['add', '-A']);
git(sub, ['commit', '-qm', 'seed']);
const parent = makeRepo({ session: '# S\n' });
git(parent, ['-c', 'protocol.file.allow=always', 'submodule', 'add', sub.replace(/\\/g, '/'), 'sub']);
git(parent, ['commit', '-qm', 'add sub']);
const subTx = landInTurn(parent, { 'src/p.mjs': 'export {};\n' }, { subject: 'parent change' });
writeFileSync(join(parent, 'sub', 'next.mjs'), 'export {};\n');
git(join(parent, 'sub'), ['add', '-A']);
git(join(parent, 'sub'), ['commit', '-qm', 'sub change (implements ZZ-T009)']);
stopOn(parent, subTx);
ok('a commit inside a submodule is noted in the parent anchor with the submodule path', landedLines(parent).some((l) => /landed sub@[0-9a-f]{7} sub change \(implements ZZ-T009\) \(ZZ-T009\): /.test(l)));
ok('the submodule has no anchor of its own written', !existsSync(join(parent, 'sub', '.ai')));

console.log(`\n${count - failures}/${count} passed`);
process.exit(failures ? 1 : 0);
