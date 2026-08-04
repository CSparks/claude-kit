// Tests for KIT-T178 — a silent subagent's long build is visible from OUTSIDE the session.
// Drives the hook the way the harness does (spawnSync, JSON payload on stdin) over throwaway
// adopted repos, then reads the file a bystander would read.
//   1. matcher: which commands count as a long build, per ecosystem.
//   2. key: a subagent's progress line is keyed by the SAME id the agent roster uses, so the
//      two join — derived from the sidechain transcript name when no handle is on the payload.
//   3. lifecycle: PreToolUse appends, PostToolUse clears, SubagentStop/Stop sweeps the rest.
//   4. orient: the in-flight listing shows `— running: cargo test (6m)`, including for a build
//      whose dispatch row has not been written yet.
//   5. fail-open: malformed file, garbage payload, unadopted repo — never a block, never a throw.
// Run: node hooks/progress.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { recordAgent, agentsPath } from './lib.mjs';
import {
  matchLongRunning, progressKey, progressPath, readProgress, progressFor, formatProgress,
  startProgress, PROGRESS_STALE_MS,
} from './progress-store.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, 'progress.mjs');
const ORIENT = join(HERE, 'orient.mjs');
const MIN_MS = 60 * 1000;
const AGENT = 'a55317e42f51677c0'; // the roster-id shape a real delegation gets
const fixtures = [];
let pass = 0;
let fail = 0;

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// Isolate every spawned hook from the real ~/.claude registry (orient self-heals it).
const TMP_REG = join(mkdtempSync(join(tmpdir(), 'kit-pg-reg-')), 'registry.json');
fixtures.push(dirname(TMP_REG));
const ENV = { ...process.env, CLAUDE_KIT_REGISTRY: TMP_REG };

function makeRepo({ adopt = true, commit = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-pg-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir, stdio: 'ignore' });
  if (adopt) mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
  if (commit) {
    writeFileSync(join(dir, 'seed.txt'), 'x\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir, stdio: 'ignore' });
  }
  return dir;
}

function hook(hookPath, payload, cwd) {
  const r = spawnSync(process.execPath, [hookPath], { input: JSON.stringify(payload), cwd, encoding: 'utf8', env: ENV });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

// A subagent's Bash payload: no agent handle, but the transcript names the agent (the real shape).
const subagentBash = (event, command) => ({
  hook_event_name: event,
  tool_name: 'Bash',
  tool_input: { command },
  transcript_path: join('C:', 'x', '.claude', 'projects', 'p', 'parent', 'subagents', `agent-${AGENT}.jsonl`),
  session_id: 'parent-session-id',
});

// Backdate a running line so elapsed rendering is deterministic.
function writeRunning(root, { key, cmd, minutesAgo, repo }) {
  mkdirSync(join(root, '.ai'), { recursive: true });
  const row = {
    ts: new Date().toISOString(), key, state: 'running', cmd,
    raw: cmd, startedAt: new Date(Date.now() - minutesAgo * MIN_MS).toISOString(), repo: repo || root,
  };
  writeFileSync(progressPath(root), JSON.stringify(row) + '\n', { flag: 'a' });
}

try {
  // ===== 1. the per-ecosystem matcher ========================================
  {
    ok('match: cargo build counts', matchLongRunning('cargo build --release') === 'cargo build');
    ok('match: cargo test counts', matchLongRunning('cargo test --workspace -- --nocapture') === 'cargo test');
    ok('match: cargo check counts', matchLongRunning('cargo check') === 'cargo check');
    ok('match: cargo clippy counts', matchLongRunning('cargo clippy --all-targets') === 'cargo clippy');
    ok('match: a toolchain-pinned cargo still counts', matchLongRunning('cargo +nightly test') === 'cargo test');
    ok('match: a cheap cargo subcommand does not', matchLongRunning('cargo fmt --check') === '');
    ok('match: a non-cargo command does not', matchLongRunning('ls -la') === '');
    ok('match: cargo mentioned mid-line does not', matchLongRunning('echo "run cargo build later"') === '');
    ok('match: garbage input is not a match', matchLongRunning(undefined) === '' && matchLongRunning(null) === '');
  }

  // ===== 2. the key joins a progress line to its roster row ===================
  {
    ok('key: an explicit agent handle wins', progressKey({ agent_id: AGENT, session_id: 's1' }) === AGENT);
    ok('key: a sidechain transcript name yields the roster id',
      progressKey({ transcript_path: `/x/subagents/agent-${AGENT}.jsonl`, session_id: 's1' }) === AGENT);
    ok('key: the main session falls back to its session id',
      progressKey({ transcript_path: '/x/projects/p/abc.jsonl', session_id: 's1' }) === 's1');
    ok('key: an empty payload still yields a usable key', progressKey({}) === 'session');
  }

  // ===== 3. lifecycle through the hook (the harness path) ====================
  {
    const d = makeRepo();
    const started = hook(HOOK, subagentBash('PreToolUse', 'cargo test --workspace'), d);
    ok('hook: PreToolUse exits 0 (observes, never gates)', started.code === 0);
    let live = readProgress(d);
    ok('hook: the running build is on disk, keyed by the roster id',
      live.length === 1 && live[0].key === AGENT && live[0].cmd === 'cargo test' && live[0].state === 'running');
    ok('hook: the line records which tree is busy', !!live[0].repo);
    ok('hook: the line records the raw command for the audit trail', live[0].raw === 'cargo test --workspace');

    // A second, different build from the same agent is its own line.
    hook(HOOK, subagentBash('PreToolUse', 'cargo clippy --all-targets'), d);
    ok('hook: two concurrent builds are two lines', readProgress(d).length === 2);

    // PostToolUse clears exactly the one that finished.
    hook(HOOK, subagentBash('PostToolUse', 'cargo test --workspace'), d);
    live = readProgress(d);
    ok('hook: PostToolUse clears its own build only', live.length === 1 && live[0].cmd === 'cargo clippy');

    // SubagentStop sweeps whatever the terminating agent still owns — keyed by agent_id, the
    // handle the PARENT session sees, which must match the key the subagent itself wrote.
    hook(HOOK, { hook_event_name: 'SubagentStop', agent_id: AGENT, agent_type: 'general-purpose' }, d);
    ok('hook: SubagentStop sweeps the agent’s remaining lines', readProgress(d).length === 0);
    ok('hook: the sweep appends, never rewrites (audit trail intact)',
      readFileSync(progressPath(d), 'utf8').trim().split('\n').length === 4); // 2 starts, 1 clear, 1 sweep
  }

  // ===== 3b. the main session's own build, swept at Stop =====================
  {
    const d = makeRepo();
    const mainBash = (event) => ({ hook_event_name: event, tool_name: 'Bash', tool_input: { command: 'cargo build' }, session_id: 'main-1' });
    hook(HOOK, mainBash('PreToolUse'), d);
    ok('stop: the main session publishes its own build too', readProgress(d).length === 1);
    hook(HOOK, { hook_event_name: 'Stop', session_id: 'other-session' }, d);
    ok('stop: another session’s Stop sweeps nothing', readProgress(d).length === 1);
    hook(HOOK, { hook_event_name: 'Stop', session_id: 'main-1' }, d);
    ok('stop: the owning session’s Stop sweeps the line', readProgress(d).length === 0);
  }

  // ===== 3c. commands that are not long builds leave no trace ================
  {
    const d = makeRepo();
    hook(HOOK, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls -la' }, session_id: 's' }, d);
    ok('noise: an ordinary command writes no progress file', !existsSync(progressPath(d)));
  }

  // ===== 4. orient surfaces it (the whole point) =============================
  {
    const d = makeRepo({ commit: true });
    recordAgent(d, { id: AGENT, status: 'in-flight', task: 'port the HUD pass', scope: 'general-purpose', background: true });
    writeRunning(d, { key: AGENT, cmd: 'cargo test', minutesAgo: 6 });
    const resume = hook(ORIENT, { hook_event_name: 'SessionStart' }, d);
    ok('orient: the in-flight agent shows what it is running, with elapsed',
      /\[in-flight\] a55317e42f51677c0 .*running: cargo test \(6m\)/.test(resume.out));

    // The dispatch row lands only when the Task RESULT does (KIT-T177), so a build with no roster
    // row yet is the COMMON case for a synchronous agent — it must still be visible.
    const d2 = makeRepo({ commit: true });
    writeRunning(d2, { key: 'a99', cmd: 'cargo build', minutesAgo: 31 });
    const resume2 = hook(ORIENT, { hook_event_name: 'SessionStart' }, d2);
    ok('orient: a build with no dispatch row still surfaces',
      /\[running\]\s+a99 — cargo build \(31m\)/.test(resume2.out) && resume2.out.includes('no dispatch row yet'));

    // A long-running agent that is demonstrably COMPILING is busy, not uncollected — suppressing
    // that false alarm is the ticket's reason for existing.
    const d3 = makeRepo({ commit: true });
    recordAgent(d3, { id: 'slow01', status: 'in-flight', task: 'a big build', scope: 'general-purpose' });
    const aged = JSON.parse(readFileSync(agentsPath(d3), 'utf8').trim());
    aged.ts = new Date(Date.now() - PROGRESS_STALE_MS).toISOString();
    writeFileSync(agentsPath(d3), JSON.stringify(aged) + '\n');
    writeRunning(d3, { key: 'slow01', cmd: 'cargo build', minutesAgo: 40 });
    const resume3 = hook(ORIENT, { hook_event_name: 'SessionStart' }, d3);
    ok('orient: a compiling agent is not flagged UNCOLLECTED', !resume3.out.includes('UNCOLLECTED'));
    ok('orient: …and its build is named instead', resume3.out.includes('running: cargo build (40m)'));

    // No progress + no roster -> no section (the pre-KIT-T178 silence is preserved).
    const d4 = makeRepo({ commit: true });
    ok('orient: a quiet repo shows no agents section',
      !hook(ORIENT, { hook_event_name: 'SessionStart' }, d4).out.includes('In-flight agents'));
  }

  // ===== 5. fail-open everywhere ============================================
  {
    // A malformed line is skipped; the valid rows survive (concurrent-writer corruption).
    const d = makeRepo();
    writeRunning(d, { key: 'k1', cmd: 'cargo test', minutesAgo: 1 });
    writeFileSync(progressPath(d), readFileSync(progressPath(d), 'utf8') + 'not json at all\n', { flag: 'w' });
    writeRunning(d, { key: 'k2', cmd: 'cargo build', minutesAgo: 1 });
    const live = readProgress(d);
    ok('fail-open: a malformed line is skipped, valid lines survive',
      live.length === 2 && live.some((r) => r.key === 'k1') && live.some((r) => r.key === 'k2'));
    ok('fail-open: the hook still runs against a corrupt file',
      hook(HOOK, subagentBash('PreToolUse', 'cargo check'), d).code === 0);

    // An abandoned line (session died before any clear/sweep landed) ages out of the live view.
    const d2 = makeRepo();
    writeRunning(d2, { key: 'zombie', cmd: 'cargo build', minutesAgo: PROGRESS_STALE_MS / MIN_MS + 1 });
    ok('fail-open: an abandoned running line ages out', readProgress(d2).length === 0);

    // A repo that never adopted .ai gets no file and no interference.
    const un = makeRepo({ adopt: false });
    ok('fail-open: an unadopted repo exits 0', hook(HOOK, subagentBash('PreToolUse', 'cargo build'), un).code === 0);
    ok('fail-open: an unadopted repo grows no progress file', !existsSync(progressPath(un)));

    // A garbage payload must never wedge a Bash call.
    const bad = spawnSync(process.execPath, [HOOK], { input: 'not json', cwd: makeRepo(), encoding: 'utf8', env: ENV });
    ok('fail-open: a malformed payload exits 0', bad.status === 0);

    ok('fail-open: readProgress on a repo with no file returns []', readProgress(makeRepo()).length === 0);
  }

  // ===== 6. the read helpers orient depends on ===============================
  {
    const d = makeRepo();
    startProgress(d, { key: AGENT, command: 'cargo test -p sim', label: 'cargo test', repo: d });
    const rows = readProgress(d);
    ok('helpers: progressFor finds an agent’s live line', progressFor(rows, AGENT).cmd === 'cargo test');
    ok('helpers: progressFor on an unknown agent is null', progressFor(rows, 'nobody') === null);
    ok('helpers: progressFor with no id is null', progressFor(rows, '') === null);
    ok('helpers: a fresh line renders in seconds', /^cargo test \(\d+s\)$/.test(formatProgress(rows[0])));
    ok('helpers: an hour-old line renders as hours+minutes',
      formatProgress({ cmd: 'cargo build', startedAt: new Date(Date.now() - 64 * MIN_MS).toISOString() }) === 'cargo build (1h4m)');
  }
} finally {
  for (const d of fixtures) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
