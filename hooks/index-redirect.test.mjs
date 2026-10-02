// Proof that the query gate redirects a grep ONLY when the code index answers it exactly
// (KIT-T101). Per shape: the gate blocks the grep, prints a `q code` equivalent, and running that
// equivalent (unbounded) returns exactly the hits real `git grep --no-index` returns on the same
// tree. Shapes the index cannot answer exactly stay allowed. Run: node hooks/index-redirect.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stopServer } from '../scripts/q-client.mjs';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('index-redirect');
const Q = join(dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'scripts', 'q.mjs');

const repo = adopted(false);
const put = (rel, text) => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), text); };
put('Cargo.toml', '[package]\nname = "fx"\n');
put('crates/sim/src/lib.rs', 'pub mod camp;\npub fn spawn_camp() {}\npub fn despawn_camp() {}\nfn colour() {}\nfn color() {}\n');
put('crates/sim/src/camp.rs', 'pub struct Camp;\nimpl Camp for Thing {}\nlet v: Vec<u8> = a.b;\n// campaign Camp CAMP camp\nfn spawn_camp_extra() {}\npub fn alpha_one() {}\nfn beta_two() {}\nfn abc(x) {}\nfn xyz() {}\nlet camp = 1;\n');
put('crates/hud/src/ui.rs', 'pub fn spawn_camp_marker() {}\nCamp here\nspawn_camp();\n');
put('assets/shaders/terrain.wgsl', 'fn terrain_height() {}\nstruct Terrain {}\nvar<uniform> terrain_uniform: u32;\n');
put('docs/guide.md', '# heading one\ntext\n## heading two\n');
execFileSync('git', ['add', '-A'], { cwd: repo });
const qEnv = { ...process.env, CLAUDE_KIT_CODE_INDEX_DIR: tmpDir('ci-'), CLAUDE_KIT_REGISTRY: join(tmpDir('reg-'), 'r.json'), CLAUDE_KIT_BUG_STORE: 'off', CLAUDE_KIT_Q_SERVER_IDLE_MS: '8000' };

const gate = (command) => hook('query-gate.mjs', { tool_input: { command } }, repo);
const truth = (args) => {
  const r = spawnSync('git', ['grep', '--no-index', ...args], { cwd: repo, encoding: 'utf8' });
  return (r.stdout || '').split('\n').filter(Boolean);
};
const hitSet = (lines) => new Set(lines.filter((l) => l !== '--').map((l) => { const m = /^(.+?)[-:](\d+)[-:]/.exec(l) || /^(.+?)[-:](\d+)\s/.exec(l); return m ? `${m[1]}:${m[2]}` : l; }));
const argv = (cmd) => (cmd.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((a) => a.replace(/^["']|["']$/g, ''));
const qLines = (eq) => {
  const [, ...rest] = argv(eq);
  const r = spawnSync(process.execPath, [...rest, '--limit', '0'], { cwd: repo, encoding: 'utf8', env: qEnv });
  return (r.stdout || '').split('\n').filter(Boolean);
};
const equivalentOf = (out) => (out.split('\n').find((l) => l.trim().startsWith('node "')) || '').trim();

// [name, grep command, git grep args (the same question asked of real grep)]
const SHAPES = [
  ['literal identifier', 'rg -t rust spawn_camp', ['-n', 'spawn_camp', '--', '*.rs']],
  ['definition phrase', 'grep -rn "fn spawn_camp" --include=*.rs .', ['-n', 'fn spawn_camp', '--', '*.rs']],
  ['phrase with spaces', 'rg -t rust "impl Camp for"', ['-n', 'impl Camp for', '--', '*.rs']],
  ['fixed string with metacharacters', 'grep -rn -F "Vec<u8>" --include=*.rs', ['-n', '-F', 'Vec<u8>', '--', '*.rs']],
  ['fixed dot is literal', 'grep -rn -F "a.b" --include=*.rs', ['-n', '-F', 'a.b', '--', '*.rs']],
  ['regex group alternation', 'rg -t rust "fn (spawn|despawn)_camp"', ['-n', '-E', 'fn (spawn|despawn)_camp', '--', '*.rs']],
  ['regex optional character', 'rg -t rust "colou?r"', ['-n', '-E', 'colou?r', '--', '*.rs']],
  ['regex top-level alternation', 'rg -t rust "alpha_one|beta_two"', ['-n', '-E', 'alpha_one|beta_two', '--', '*.rs']],
  ['regex with escaped paren and alternation', 'rg -t rust "abc\\(|xyz"', ['-n', '-E', 'abc\\(|xyz', '--', '*.rs']],
  ['regex anchor', 'rg -t rust "^pub fn"', ['-n', '-E', '^pub fn', '--', '*.rs']],
  ['case-insensitive', 'rg -i -t rust campaign', ['-n', '-i', 'campaign', '--', '*.rs']],
  ['whole word', 'rg -w -t rust camp', ['-n', '-w', 'camp', '--', '*.rs']],
  ['context lines', 'rg -C 1 -t rust spawn_camp', ['-n', '-C', '1', 'spawn_camp', '--', '*.rs']],
  ['path scope', 'rg -t rust spawn_camp crates/hud', ['-n', 'spawn_camp', '--', 'crates/hud/*.rs']],
  ['files only', 'rg -l -t rust spawn_camp', ['-l', 'spawn_camp', '--', '*.rs']],
  ['wgsl glob', "rg -g '*.wgsl' terrain", ['-n', 'terrain', '--', '*.wgsl']],
  ['markdown type', 'rg -t md heading', ['-n', 'heading', '--', '*.md']],
];

try {
  for (const [name, command, gitArgs] of SHAPES) {
    const g = gate(command);
    const eq = equivalentOf(g.out);
    ok(`${name}: the gate redirects and prints a q equivalent`, g.code === 2 && /q\.mjs" code /.test(eq));
    if (!eq) continue;
    const want = gitArgs.includes('-l') ? new Set(truth(gitArgs)) : hitSet(truth(gitArgs));
    const got = gitArgs.includes('-l') ? new Set(qLines(eq).map((l) => l.split(/\s{2}/)[0])) : hitSet(qLines(eq));
    const same = want.size === got.size && [...want].every((x) => got.has(x));
    ok(`${name}: the q equivalent returns exactly grep's hits (${want.size})`, same && want.size > 0);
    if (!same) console.log('        want', [...want].sort().join(' '), '| got', [...got].sort().join(' '));
  }

  // Shapes the index cannot answer exactly stay allowed (exit 0): nothing is redirected to a lossy answer.
  const ALLOWED = [
    ['invert match', 'rg -v -t rust spawn_camp'],
    ['PCRE look-behind', 'rg -P "(?<=a)b" -t rust'],
    ['BRE metacharacters without -E', 'grep -rn "spawn.*camp" --include=*.rs .'],
    ['-w on a regex', 'rg -w -t rust "a|b"'],
    ['multiple patterns', 'rg -e spawn -e camp -t rust'],
    ['unmodelled flag (-o)', 'rg -o -t rust spawn_camp'],
    ['path outside the repo', 'rg -t rust spawn_camp /etc'],
    ['two paths', 'rg -t rust spawn_camp crates/sim crates/hud'],
    ['a glob path', 'rg -t rust spawn_camp crates/*/src'],
    ];
  for (const [name, command] of ALLOWED) ok(`not redirected: ${name}`, gate(command).code === 0);
  const unscoped = gate('rg spawn_camp crates');
  ok('a grep with no language scope is not answered by the index (the graph message, not a lossy redirect)', unscoped.code === 2 && !/code index answers/.test(unscoped.out));
} finally {
  process.env.CLAUDE_KIT_CODE_INDEX_DIR = qEnv.CLAUDE_KIT_CODE_INDEX_DIR;
  await stopServer(); // the queries above auto-started a resident server for this cache dir
  cleanup();
}
done();
