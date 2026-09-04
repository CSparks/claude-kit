// Automated test for the retrieval gate (hooks/query-gate.mjs). Spins up throwaway
// adopted repos and asserts: BLOCK on store search + tree-wide source discovery;
// ALLOW on targeted single-file grep, piped output filtering, q/code-graph calls,
// non-search commands, and unadopted repos. Run: node hooks/query-gate.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./query-gate.mjs', import.meta.url));
let failures = 0;

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'qg-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai', 'decisions'), { recursive: true });
  return dir;
}

function run(dir, command) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir, input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8',
  });
  return { code: r.status, err: r.stderr || '' };
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

const d = makeRepo();
const un = makeRepo({ adopt: false });

// BLOCK — DISCOVERY search over the .ai work store (recursive/dir → q owns it).
expect('blocks grep over .ai store', run(d, 'grep -rn "physics" .ai/decisions/').code, 2);
expect('blocks find over the store', run(d, 'find .ai/tickets -name "*.md"').code, 2);

// BLOCK — tree-wide source discovery (JS/TS — code-graph CAN answer these).
expect('blocks recursive grep of source', run(d, 'grep -rn "PhysicsSim" src/').code, 2);
expect('blocks bare rg (recursive by default)', run(d, 'rg PhysicsSim').code, 2);
expect('blocks git grep discovery', run(d, 'git grep usePhysics').code, 2);
expect('blocks rg with --include=*.ts (indexed ext)', run(d, 'rg --include=*.ts "useState" src/').code, 2);

// KIT-T272 COVERAGE MODEL — a redirect fires only when the target can answer. `find … -name` is a
// FILENAME lookup, outside code-graph's coverage (it has no filename query, and indexes no assets) —
// so it passes; Glob is the tool for it. Reading ONE named store file is the maintainer's allowed case.
expect('allows find -name *.ts (filename lookup is Glob, not code-graph)', run(d, 'find . -name "*.ts"').code, 0);
expect('allows find over an ASSET dir (the lived FP: dead-ended to code-graph)', run(d, "find assets/meshes -name '*raider*'").code, 0);
expect('allows cat of ONE named decision ITEM file (q has no raw shape/next-id)', run(d, 'cat .ai/decisions/HOD-D004.md').code, 0);
expect('allows sed-paginate of ONE named ticket ITEM file', run(d, 'sed -n 1,5p .ai/tickets/KIT-T001.md').code, 0);
expect('allows a single-file grep of a store item file (targeted, you know where)', run(d, 'grep uat .ai/tickets/KIT-T001.md').code, 0);
expect('allows a heredoc/redirect WRITE whose body names a store path (memory-file FP)',
  run(d, "cat >> memory.md <<'EOF'\nsee .ai/decisions/HOD-D004.md\nEOF").code, 0);
expect('allows the ls+cat store-format lookup (the 4th over-block)',
  run(d, 'ls .ai/decisions | tail -5 && cat .ai/decisions/HOD-D004.md').code, 0);

// ALLOW — the maintainer's rule: grep is fine for a SPECIFIC known file, and a pipe
// only filters a command's OUTPUT (not a file search).
expect('allows targeted grep of one file', run(d, 'grep usePhysics src/main.ts').code, 0);
expect('allows rg on one specific file', run(d, 'rg usePhysics src/main.ts').code, 0);
expect('allows piped output filter', run(d, 'git log --oneline | grep physics').code, 0);
expect('allows q output piped to grep', run(d, 'node scripts/q.mjs sql "select 1" | grep x').code, 0);

// KIT-T056 — chain/pipe escapes are judged; legit user dirs named like stores pass.
expect('blocks ||-chained store grep (leader-split escape)', run(d, 'true || grep -rn x .ai/decisions/').code, 2);
// KIT-T056 intent (every segment is judged) with a DISCOVERY store op — a single named-file read
// is now allowed (KIT-T272), so these probe the recursive/dir form that still routes to q.
expect('blocks ;-chained store DISCOVERY after a pipe', run(d, 'git log | grep x; grep -rn secret .ai/decisions/').code, 2);
expect('blocks piped grep doing DISCOVERY over a store dir', run(d, 'echo x | grep -rn y .ai/tickets/').code, 2);
expect('blocks find|xargs grep discovery', run(d, 'git ls-files | xargs grep -r usePhysics src/').code, 2);
expect('allows grep of src/notes/ (user dir, not the store)', run(d, 'grep todo src/notes/api.md').code, 0);
expect('allows cat of src/tickets/ file (user dir)', run(d, 'cat src/tickets/parser.ts').code, 0);
expect('blocks centralized store path DISCOVERY (projects/<name>/tickets)', run(d, 'grep -rn x D:/data/projects/foo/tickets/').code, 2);
expect('still blocks bare store dir at token start', run(d, 'grep -rn x tickets/').code, 2);
expect('allows piped grep with pattern containing no path', run(d, 'git log --oneline | grep -i decisions').code, 0);
expect('allows piped filter whose quoted PATTERN has regex slashes', run(d, "npm test | select-string -pattern '^(all pass|\\d+ FAIL)'").code, 0);
expect('allows piped grep with unquoted slashed PATTERN (no file arg)', run(d, 'git log | grep src/notes').code, 0);

// KIT-T080 — a targeted read/grep of ONE CONFIG/STATE store file is allowed (q can't return it);
// individual ITEM files (tickets/decisions/...) still route to q; tree-wide/multi still blocks.
expect('allows cat of .ai/config.yml', run(d, 'cat .ai/config.yml').code, 0);
expect('allows sed paginate of config.yml', run(d, "sed -n '1,80p' .ai/config.yml").code, 0);
expect('allows head -n of SESSION.md (flag value not a path)', run(d, 'head -n 40 .ai/SESSION.md').code, 0);
expect('allows targeted grep of config.yml', run(d, 'grep uat .ai/config.yml').code, 0);
// KIT-T272: reading ONE named item file is now allowed (the maintainer's specific-named-file case;
// CLAUDE.md itself says "Read .ai/tickets/T-001*.md"). Multi-file / discovery over the store still routes to q.
expect('allows reading ONE named decision ITEM file (KIT-T272)', run(d, 'cat .ai/decisions/HOD-D004.md').code, 0);
expect('allows reading ONE named ticket ITEM file (KIT-T272)', run(d, 'sed -n 1,5p .ai/tickets/KIT-T001.md').code, 0);
expect('blocks multi-file store read (not "one specific")', run(d, 'cat .ai/config.yml .ai/SESSION.md').code, 2);

// KIT-T085 — Rust/WGSL and other non-indexed-extension greps MUST be allowed.
// code-graph only indexes JS/TS; blocking Rust/WGSL discovery is a dead end.
expect('allows grep --include=*.rs (Rust — not indexed)', run(d, 'grep -rn "set_environment" --include=*.rs src/').code, 0);
expect('allows grep --include=*.wgsl (WGSL — not indexed)', run(d, 'grep -rn "terrain" --include=*.wgsl src/shaders/').code, 0);
expect('allows rg -t rust (Rust type flag)', run(d, 'rg -t rust "fn spawn"').code, 0);
expect('allows find . -name "*.rs" (Rust — not indexed)', run(d, 'find . -name "*.rs"').code, 0);
expect('allows find . -name "*.wgsl" (WGSL — not indexed)', run(d, 'find . -name "*.wgsl"').code, 0);
expect('allows rg --include=*.rs (long include form)', run(d, 'rg --include=*.rs "impl Vehicle"').code, 0);
expect('still blocks rg --include=*.ts (TS is indexed)', run(d, 'rg --include=*.ts "PhysicsSim"').code, 2);
expect('still blocks plain rg with no ext signal (unknown scope)', run(d, 'rg PhysicsBody').code, 2);

// KIT-T167 — listing workflow DATA (.ai stores, the claude-kit-data projects tree) is not
// source discovery: code-graph indexes none of it. store-grep stays the arbiter for .ai paths;
// the data root, which no store pattern matches, is simply allowed.
expect('allows listing a claude-kit-data project dir (was a source-discovery false positive)',
  run(d, 'Get-ChildItem -Recurse D:\\dev\\claude-kit-data\\projects\\gridiron-blitz').code, 0);
expect('allows a recursive listing of claude-kit-data (forward slashes)',
  run(d, 'find D:/dev/claude-kit-data/projects -name "*.md"').code, 0);
expect('a .ai listing blocks under store-grep, NOT source-discovery',
  run(d, 'Get-ChildItem -Recurse .ai/tickets').err.includes('searching the .ai work store'), true);
expect('a .ai listing is still blocked (q is the route)', run(d, 'Get-ChildItem -Recurse .ai/tickets').code, 2);
// Negative control: the workflow-data exemption must not leak into real source discovery.
expect('STILL blocks recursive source grep (exemption did not widen)', run(d, 'rg foo src/').code, 2);
// KIT-T272: `find src -name` now passes — filename lookup is outside code-graph's coverage. The
// SEARCH block (the hook's real point) is what must stay: a symbol grep over source still blocks.
expect('allows find over src (filename lookup, not code-graph coverage — KIT-T272)', run(d, 'find src -name "*.ts"').code, 0);
expect('STILL blocks a symbol SEARCH over source (the block that earns its keep)', run(d, 'grep -rn useState src/').code, 2);

// KIT-T236 — a query-tool failure is a stop-and-file, stated on both block messages.
expect('store-grep message states the hard-stop-and-file rule',
  run(d, 'grep -rn "physics" .ai/decisions/').err.includes('HARD STOP'), true);
expect('source-discovery message states the hard-stop-and-file rule',
  run(d, 'rg PhysicsSim').err.includes('HARD STOP'), true);
// KIT-T238 — the store-grep message names the inbox verbs it forces traffic onto.
expect('store-grep message lists q inbox / q confirmations',
  /q\.mjs" inbox[\s\S]*q\.mjs" confirmations/.test(run(d, 'grep -rn x .ai/inbox/').err), true);

// KIT-T085 AC3 — targeted grep of .ai/config.yml is allowed (KIT-T080 carve-out).
expect('allows grep of ids from config.yml (AC3)', run(d, 'grep ids .ai/config.yml').code, 0);
expect('allows grep of key from config.yml', run(d, 'grep key .ai/config.yml').code, 0);

// ALLOW — the query tools themselves, ordinary commands, and unadopted repos.
expect('allows q governing', run(d, 'node scripts/q.mjs governing src/main.ts').code, 0);
expect('allows code-graph query', run(d, 'node scripts/code-graph.mjs --query defines PhysicsSim').code, 0);
expect('allows a build command', run(d, 'npm run build').code, 0);
expect('no-ops on unadopted repo', run(un, 'grep -rn secret .ai/').code, 0);

// FAIL-OPEN (KIT-T272) — this hook is loaded LIVE by other sessions; a crash/parse error mid-flight
// must NEVER block a tool call. Feed raw non-JSON on stdin and assert exit 0, not a block.
function runRaw(dir, input) {
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, input, encoding: 'utf8' });
  return r.status;
}
expect('fail-open: malformed (non-JSON) payload exits 0, never blocks', runRaw(d, 'not json {{{'), 0);
expect('fail-open: empty payload exits 0', runRaw(d, ''), 0);
expect('fail-open: JSON without tool_input exits 0', runRaw(d, JSON.stringify({ foo: 1 })), 0);

console.log(failures ? `\n${failures} FAIL` : '\nall pass');
process.exit(failures ? 1 : 0);
