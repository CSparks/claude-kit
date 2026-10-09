#!/usr/bin/env node
// Tests for the code index (KIT-T101): symbol extraction per language, incremental refresh by
// mtime, kinds and the framework submodule, every q code/sym/file filter, prefilter soundness
// (it may only ADD candidates), and parity of the no-engine fallback.
// Run: node scripts/code-index.test.mjs

import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { classify, extractSymbols } from './code-index-extract.mjs';
import { execFileSync } from 'node:child_process';
import { listIndexable, refreshIndex } from './code-index.mjs';
import { buildMatcher, codeVerbRows, ftsCodeDefs, parseCodeArgs, prefilter } from './code-index-query.mjs';
import { resolveEngine } from './db-engine.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const cache = mkdtempSync(join(tmpdir(), 'ci-cache-'));
process.env.CLAUDE_KIT_CODE_INDEX_DIR = cache;
const root = mkdtempSync(join(tmpdir(), 'ci-repo-'));
const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
put('.gitmodules', '[submodule "rapid-game"]\n\tpath = rapid-game\n');
put('rapid-game/.git', 'gitdir: ../.git/modules/rapid-game\n');
put('rapid-game/.ai/config.yml', 'ids:\n  key: "RGT"\n');
put('rapid-game/.ai/tickets/RGT-T1-sleep.md', '---\nid: RGT-T1\ntitle: sleepwake rings\n---\nframework ticket body\n');
put('rapid-game/rust/core/src/lib.rs', 'pub trait Wake {}\npub fn frame_budget() {}\n');
put('.ai/config.yml', 'ids:\n  key: "GAM"\n');
put('.ai/tickets/GAM-T1-camps.md', '---\nid: GAM-T1\ntitle: puppet camps\n---\ngame ticket body\n');
put('.ai/decisions/GAM-D1.md', '---\nid: GAM-D1\ntitle: camps rule\n---\ndecision body\n');
put('package.json', '{}');
put('src/sim.rs', 'use std::collections::{HashMap, HashSet as Set};\npub use crate::wake::Wake;\n\npub mod camp;\nmod private;\n\n/// docs\npub struct Camp { x: u32 }\npub enum Mood { Calm }\npub trait Raid {}\nimpl Raid for Camp {}\nimpl Camp {\n    pub async fn spawn(&self) {}\n    pub(crate) const fn limit() -> u32 { 3 }\n}\nconst MAX_CAMPS: usize = 4;\nstatic mut COUNT: u32 = 0;\nmacro_rules! boom { () => {} }\ntype Alias = u32;\n');
put('shaders/terrain.wgsl', 'struct Light { dir: vec3<f32> }\n@group(0) @binding(0) var<uniform> light: Light;\nconst PI: f32 = 3.14;\nfn shade(p: vec3<f32>) -> f32 { return 1.0; }\n');
put('web/app.ts', 'export class Widget {}\nexport function render() {}\nexport const load = async () => 1;\nconst plain = 5;\nexport interface Props {}\n');
put('docs/guide.md', '# Guide\ntext about camps\n## Setup\n');
put('config/tuning.toml', '[camp]\nradius = 12\n[[wave]]\nsize = 3\n');

const readSrc = (rel) => readFileSync(join(root, rel), 'utf8');
const rows = (cmd, args) => codeVerbRows(cmd, args, root);
const locs = (r) => r.map((x) => x.loc).filter(Boolean);

await test('classify: kinds and languages; lockfiles and unknown types are not indexed', () => {
  assert.deepEqual(classify('a/b.rs'), { kind: 'code', lang: 'rust' });
  assert.deepEqual(classify('a/b.wgsl'), { kind: 'code', lang: 'wgsl' });
  assert.deepEqual(classify('d/x.md'), { kind: 'doc', lang: 'md' });
  assert.deepEqual(classify('c/x.toml'), { kind: 'config', lang: 'toml' });
  assert.equal(classify('Cargo.lock'), null);
  assert.equal(classify('a/b.glb'), null);
});

await test('rust symbols: fn struct enum trait impl const static macro type mod use', () => {
  const syms = extractSymbols('rust', readSrc('src/sim.rs'));
  const has = (type, name) => syms.some((s) => s.type === type && s.name === name);
  for (const [t, n] of [['fn', 'spawn'], ['fn', 'limit'], ['struct', 'Camp'], ['enum', 'Mood'], ['trait', 'Raid'], ['const', 'MAX_CAMPS'], ['const', 'COUNT'], ['macro', 'boom'], ['type', 'Alias'], ['mod', 'camp'], ['mod', 'private'], ['use', 'HashMap'], ['use', 'Set'], ['use', 'Wake']]) assert.ok(has(t, n), `${t} ${n}`);
  const impls = syms.filter((s) => s.type === 'impl');
  assert.deepEqual(impls.map((s) => [s.name, s.scope]), [['Camp', 'Raid'], ['Camp', '']]);
});

await test('wgsl, js/ts, md and toml symbols', () => {
  const w = extractSymbols('wgsl', readSrc('shaders/terrain.wgsl'));
  assert.deepEqual(w.map((s) => `${s.type}:${s.name}`), ['struct:Light', 'var:light', 'const:PI', 'fn:shade']);
  const j = extractSymbols('js/ts', readSrc('web/app.ts'));
  assert.deepEqual(j.map((s) => `${s.type}:${s.name}`), ['class:Widget', 'fn:render', 'fn:load', 'const:plain', 'type:Props']);
  assert.deepEqual(extractSymbols('md', readSrc('docs/guide.md')).map((s) => s.name), ['Guide', 'Setup']);
  assert.deepEqual(extractSymbols('toml', readSrc('config/tuning.toml')).map((s) => s.name), ['camp', 'wave']);
});

await test('refresh indexes the repo and its framework submodule; second refresh is a no-op', async () => {
  const a = await refreshIndex(root);
  assert.ok(a.added > 8 && a.changed === 0 && a.removed === 0);
  a.handle?.close();
  const b = await refreshIndex(root);
  assert.equal(b.added + b.changed + b.removed, 0);
  b.handle?.close();
  assert.ok(a.files.some((f) => f.rel.startsWith('rapid-game/rust/')), 'framework source is indexed');
  assert.ok(a.files.some((f) => f.rel === 'rapid-game/.ai/tickets/RGT-T1-sleep.md' && f.kind === 'ticket'), 'framework tickets are indexed');
});

await test('refresh is incremental: a changed file, a new file and a removed file', async () => {
  put('src/new.rs', 'pub fn fresh_symbol() {}\n');
  put('src/sim.rs', readSrc('src/sim.rs') + 'pub fn appended() {}\n');
  const future = new Date(Date.now() + 5000);
  utimesSync(join(root, 'src/sim.rs'), future, future);
  put('src/gone.rs', 'fn bye() {}\n');
  let r = await refreshIndex(root); r.handle?.close();
  unlinkSync(join(root, 'src/gone.rs'));
  r = await refreshIndex(root); r.handle?.close();
  assert.equal(r.removed, 1);
  assert.deepEqual(locs(await rows('sym', ['fresh_symbol'])), ['src/new.rs:1']);
  assert.equal(locs(await rows('sym', ['appended'])).length, 1, 'the changed file was re-indexed');
  assert.deepEqual(locs(await rows('sym', ['bye'])), []);
});

await test('git change signal: warm refresh re-reads only what git reports (modify, add, delete, commit, checkout)', async () => {
  const g = mkdtempSync(join(tmpdir(), 'ci-git-'));
  const sh = (...a) => execFileSync('git', ['-C', g, '-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { stdio: 'ignore' });
  const w = (rel, text) => { mkdirSync(dirname(join(g, rel)), { recursive: true }); writeFileSync(join(g, rel), text); };
  const db = join(cache, 'git-fixture.db');
  const refresh = async () => { const r = await refreshIndex(g, { dbPath: db }); r.handle?.close(); return r; };
  sh('init', '-q'); w('a.rs', 'fn one() {}\n'); w('b.rs', 'fn two() {}\n'); w('skip.log', 'x\n'); w('.gitignore', 'ignored.rs\n'); w('ignored.rs', 'fn hidden() {}\n');
  sh('add', '-A'); sh('commit', '-q', '-m', 'base');
  let r = await refresh();
  assert.equal(r.added, 2, 'tracked source only: gitignored files are not indexed');
  r = await refresh();
  assert.equal(r.added + r.changed + r.removed, 0, 'nothing moved, nothing re-read');
  w('a.rs', 'fn one() {}\nfn extra() {}\n'); w('c.rs', 'fn three() {}\n'); unlinkSync(join(g, 'b.rs'));
  r = await refresh();
  assert.deepEqual([r.added, r.changed, r.removed], [1, 1, 1]);
  sh('add', '-A'); sh('commit', '-q', '-m', 'work');
  r = await refresh();
  assert.equal(r.added + r.changed + r.removed, 0, 'committing what the index already holds changes nothing');
  sh('checkout', '-q', 'HEAD~1');
  r = await refresh();
  assert.deepEqual([r.added, r.changed, r.removed], [1, 1, 1], 'a HEAD move re-reads the files that differ (b.rs back, c.rs gone, a.rs reverted)');
  const warm = await refresh();
  const full = await refreshIndex(g, { dbPath: join(cache, 'git-full.db'), files: listIndexable(g) });
  full.handle?.close();
  assert.deepEqual(warm.files.map((f) => f.rel).sort(), full.files.map((f) => f.rel).sort(), 'warm file set equals a full listing');
  rmSync(g, { recursive: true, force: true });
});

await test('q sym: exact, fuzzy, --type, --lang, --path', async () => {
  assert.deepEqual(locs(await rows('sym', ['Camp', '--type', 'struct'])), ['src/sim.rs:8']);
  assert.equal(locs(await rows('sym', ['Camp'])).length, 3, 'struct + two impls');
  assert.ok((await rows('sym', ['amp', '--fuzzy'])).some((r) => r.name === 'Camp'));
  assert.deepEqual((await rows('sym', ['--type', 'trait', '--lang', 'rust'])).map((r) => r.name).sort(), ['Raid', 'Wake']);
  assert.deepEqual(locs(await rows('sym', ['--type', 'trait', '--path', 'rapid-game'])), ['rapid-game/rust/core/src/lib.rs:1']);
  assert.deepEqual((await rows('sym', ['--type', 'use', '--path', 'src'])).map((r) => r.name).sort(), ['HashMap', 'Set', 'Wake']);
  assert.deepEqual((await rows('sym', ['--type', 'mod'])).map((r) => r.name).sort(), ['camp', 'private']);
});

await test('q code: kind filter spans code, docs, config and tickets (framework included)', async () => {
  assert.ok(locs(await rows('code', ['camp', '--kind', 'doc'])).every((l) => l.startsWith('docs/')));
  assert.deepEqual(locs(await rows('code', ['radius', '--kind', 'config'])), ['config/tuning.toml:2']);
  const tickets = locs(await rows('code', ['ticket body', '--kind', 'ticket']));
  assert.deepEqual(tickets.sort(), ['.ai/tickets/GAM-T1-camps.md:5', 'rapid-game/.ai/tickets/RGT-T1-sleep.md:5']);
  assert.ok(!locs(await rows('code', ['ticket body'])).length, 'tickets are not searched unless asked');
});

await test('q code: -i, -w, --regex, --fuzzy, --lang, --path, -C, -l, -c, --limit', async () => {
  assert.equal(locs(await rows('code', ['camp', '--lang', 'rust', '-w'])).length > 0, true);
  assert.deepEqual(locs(await rows('code', ['CAMP_LIMIT', '-i', '--lang', 'rust'])), []);
  assert.ok(locs(await rows('code', ['max_camps', '-i', '--lang', 'rust'])).includes('src/sim.rs:16'));
  assert.deepEqual(locs(await rows('code', ['fn (spawn|limit)', '--regex', '--lang', 'rust'])).sort(), ['src/sim.rs:13', 'src/sim.rs:14']);
  assert.deepEqual(locs(await rows('code', ['spawn fn', '--fuzzy', '--lang', 'rust'])), ['src/sim.rs:13']);
  assert.deepEqual(locs(await rows('code', ['frame_budget', '--path', 'rapid-game'])), ['rapid-game/rust/core/src/lib.rs:2']);
  assert.deepEqual(locs(await rows('code', ['frame_budget', '--path', 'src'])), []);
  assert.deepEqual(locs(await rows('code', ['Light', '--lang', 'wgsl', '-A', '1'])).slice(0, 2), ['shaders/terrain.wgsl:1', 'shaders/terrain.wgsl-2']);
  assert.deepEqual((await rows('code', ['camp', '--lang', 'rust', '-l'])).map((r) => r.loc), ['src/sim.rs']);
  assert.match((await rows('code', ['camp', '--lang', 'rust', '-c']))[0].text, /^\d+$/);
  const limited = await rows('code', ['camp', '--limit', '1', '--kind', 'code,doc,config']);
  assert.match(limited[limited.length - 1].text, /more hit\(s\).*--limit 0/);
});

await test('definitions rank before plain mentions', async () => {
  const r = await rows('code', ['spawn', '--lang', 'rust']);
  assert.equal(r[0].loc, 'src/sim.rs:13');
});

await test('q file: substring, glob and filters', async () => {
  assert.deepEqual(locs(await rows('file', ['terrain'])), ['shaders/terrain.wgsl']);
  assert.deepEqual(locs(await rows('file', ['*.toml'])), ['config/tuning.toml']);
  assert.ok(locs(await rows('file', ['lib.rs', '--path', 'rapid-game'])).every((l) => l.startsWith('rapid-game/')));
});

await test('unknown flag is reported, not silently ignored', async () => {
  process.env.CLAUDE_KIT_BUG_STORE = 'off';
  const r = await rows('code', ['camp', '--bogus']);
  assert.match(r[0].text, /does not take --bogus/);
  assert.equal(parseCodeArgs(['x', '-3']).flags.unknown.length, 0);
});

await test('grep-style attached options: -B1 / -A1 / -C2 and --lang=wgsl equal their spaced forms (KIT-T303)', async () => {
  process.env.CLAUDE_KIT_BUG_STORE = 'off';
  const spaced = await rows('code', ['shade', '-B', '1', '--lang', 'wgsl']);
  assert.deepEqual(await rows('code', ['shade', '-B1', '--lang=wgsl']), spaced);
  assert.deepEqual(locs(spaced), ['shaders/terrain.wgsl-3', 'shaders/terrain.wgsl:4']);
  assert.deepEqual(await rows('code', ['Light', '-A1', '--lang', 'wgsl']), await rows('code', ['Light', '-A', '1', '--lang', 'wgsl']));
  assert.deepEqual(parseCodeArgs(['x', '-C2']).flags, parseCodeArgs(['x', '-C', '2']).flags);
  assert.deepEqual(parseCodeArgs(['x', '-B2']).flags.unknown, []);
  assert.deepEqual(parseCodeArgs(['x', '-Bx']).flags.unknown, ['-Bx'], 'a non-numeric count is still unknown');
  assert.deepEqual(parseCodeArgs(['x', '--bogus=1']).flags.unknown, ['--bogus=1'], 'an unknown option is still reported');
});

await test('--regex reads grep\'s \\| as alternation when no bare | is present (KIT-T304)', async () => {
  assert.deepEqual(locs(await rows('code', ['Light\\|shade', '--regex', '--lang', 'wgsl'])), ['shaders/terrain.wgsl:1', 'shaders/terrain.wgsl:2', 'shaders/terrain.wgsl:4']);
  assert.deepEqual(await rows('code', ['Light\\|shade', '--regex', '--lang', 'wgsl', '-l']), await rows('code', ['Light|shade', '--regex', '--lang', 'wgsl', '-l']));
  assert.equal(parseCodeArgs(['a\\|b', '--regex']).text, 'a|b');
  assert.equal(parseCodeArgs(['a\\|b|c', '--regex']).text, 'a\\|b|c', 'a bare | keeps JS meaning');
  assert.equal(parseCodeArgs(['a\\|b']).text, 'a\\|b', 'literal text is untouched without --regex');
  assert.deepEqual(locs(await rows('code', ['Light\\|shade', '--lang', 'wgsl'])), [], 'a literal search for the pipe text finds nothing');
});

await test('prefilter soundness: a matching line always satisfies the prefilter (random regexes)', () => {
  const pieces = ['ab', 'c?', '(x|y)', '[a-z]', '\\.', 'd*', 'e+', 'f{2}', 'gh', 'ij?', '\\d', '(kl|mn)', 'op'];
  const alphabet = 'abcdefghijklmnopxy. 0123';
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    const parts = Array.from({ length: 1 + rnd(4) }, () => pieces[rnd(pieces.length)]);
    const pat = parts.join('') + (rnd(4) === 0 ? `|${pieces[rnd(pieces.length)]}${pieces[rnd(pieces.length)]}` : '');
    const flags = { regex: true };
    const m = buildMatcher(pat, flags);
    const pre = prefilter(pat, flags);
    if (!m) continue;
    for (let j = 0; j < 60; j++) {
      const line = Array.from({ length: 4 + rnd(14) }, () => alphabet[rnd(alphabet.length)]).join('');
      if (!m(line)) continue;
      checked++;
      if (!pre) continue;
      const low = line.toLowerCase();
      const ok = pre.mode === 'and' ? pre.terms.every((t) => low.includes(t.toLowerCase())) : pre.terms.some((t) => low.includes(t.toLowerCase()));
      assert.ok(ok, `pattern ${pat} matched "${line}" but prefilter ${JSON.stringify(pre)} rejects it`);
    }
  }
  assert.ok(checked > 200, `only ${checked} matching lines exercised`);
});

await test('no-engine fallback answers the same hits as the index', async () => {
  const { codeVerbRows: indexed } = await import('./code-index-query.mjs');
  const want = (await indexed('code', ['camp', '--lang', 'rust', '--limit', '0'], root)).map((r) => r.loc);
  const engine = await resolveEngine();
  assert.ok(want.length > 0 && engine, 'an engine is present for this comparison');
  process.env.CLAUDE_KIT_CODE_INDEX_FORCE_SCAN = '1';
  const got = (await indexed('code', ['camp', '--lang', 'rust', '--limit', '0'], root)).map((r) => r.loc);
  delete process.env.CLAUDE_KIT_CODE_INDEX_FORCE_SCAN;
  assert.deepEqual(got.sort(), want.sort());
});

// ---- ftsCodeDefs: the "also in code" section under q fts ----------------------
const deco = mkdtempSync(join(tmpdir(), 'ci-deco-'));
const putDeco = (rel, text) => { mkdirSync(dirname(join(deco, rel)), { recursive: true }); writeFileSync(join(deco, rel), text); };
putDeco('.ai/config.yml', 'ids:\n  key: "DCO"\n');
putDeco('.ai/tickets/DCO-T1-decor.md', '---\nid: DCO-T1\ntitle: photoshop-style layer decoration\n---\nroles and skinning\n');
putDeco('rust/paint/decor.rs', 'pub struct Bevel { depth: u32 }\npub fn apply_bevel_pass() {}\nfn unrelated() {}\nuse crate::Bevel as Edge;\nimpl Bevel {}\n');
putDeco('docs/notes.md', '# Bevel\n');

await test('ftsCodeDefs: a term no ticket words surfaces the code definition, exact name first', async () => {
  const defs = await ftsCodeDefs('procedural texture layer bevel', deco);
  assert.deepEqual(defs.map((d) => [d.loc, d.type, d.name]), [
    ['rust/paint/decor.rs:1', 'struct', 'Bevel'],
    ['rust/paint/decor.rs:2', 'fn', 'apply_bevel_pass'],
  ]);
});

await test('ftsCodeDefs: skips uses, impls and doc headings; operators and short terms are not terms', async () => {
  assert.deepEqual(await ftsCodeDefs('edge OR NOT an', deco), []);
  assert.equal((await ftsCodeDefs('bevel', deco)).some((d) => ['impl', 'use'].includes(d.type) || d.loc.startsWith('docs/')), false);
});

await test('ftsCodeDefs: at most five hits', async () => {
  putDeco('rust/many.rs', Array.from({ length: 9 }, (_, i) => `fn widget_${i}() {}`).join('\n'));
  assert.equal((await ftsCodeDefs('widget', deco)).length, 5);
});

await test('CLI: q fts prints an "also in code" section only when a term names a definition', () => {
  const env = { ...process.env, CLAUDE_KIT_CODE_INDEX_DIR: cache, CLAUDE_KIT_Q_SERVER: 'off', CLAUDE_KIT_BUG_STORE: 'off' };
  const fts = (term) => execFileSync(process.execPath, [join(import.meta.dirname, 'q.mjs'), '--no-db', '--root', deco, 'fts', term], { encoding: 'utf8', env });
  assert.match(fts('bevel'), /also in code \(q sym\):\n.*rust\/paint\/decor\.rs:1\s+struct\s+Bevel/);
  assert.doesNotMatch(fts('decoration'), /also in code/);
});

await test('--project searches that registered project checkout from any cwd (code, sym, file)', async () => {
  const other = mkdtempSync(join(tmpdir(), 'ci-other-'));
  mkdirSync(join(other, '.ai'), { recursive: true });
  writeFileSync(join(other, '.ai', 'config.yml'), 'ids:\n  key: "OTH"\n');
  mkdirSync(join(other, 'scripts'), { recursive: true });
  writeFileSync(join(other, 'scripts', 'deploy.mjs'), 'export function deployToDevice() {}\n');
  const reg = join(cache, 'registry.json');
  writeFileSync(reg, JSON.stringify({ projects: { 'other-proj': other } }));
  const prior = process.env.CLAUDE_KIT_REGISTRY;
  process.env.CLAUDE_KIT_REGISTRY = reg;
  try {
    assert.deepEqual(locs(await rows('code', ['deployToDevice'])), []);
    assert.deepEqual(locs(await rows('code', ['deployToDevice', '--project', 'other-proj'])), ['scripts/deploy.mjs:1']);
    assert.deepEqual(locs(await rows('code', ['--project=OTH', 'deployToDevice'])), ['scripts/deploy.mjs:1']);
    assert.deepEqual(locs(await rows('sym', ['deployToDevice', '--project', 'other-proj'])), ['scripts/deploy.mjs:1']);
    assert.deepEqual(locs(await rows('file', ['deploy', '--project', 'other-proj'])), ['scripts/deploy.mjs']);
    await assert.rejects(rows('code', ['x', '--project', 'nope']), /unknown project 'nope'/);
    const env = { ...process.env, CLAUDE_KIT_CODE_INDEX_DIR: cache, CLAUDE_KIT_Q_SERVER: 'off', CLAUDE_KIT_REGISTRY: reg };
    const out = execFileSync(process.execPath, [join(import.meta.dirname, 'q.mjs'), '--root', root, 'code', 'deployToDevice', '--project', 'other-proj'], { encoding: 'utf8', env });
    assert.match(out, /scripts\/deploy\.mjs:1/);
  } finally {
    if (prior === undefined) delete process.env.CLAUDE_KIT_REGISTRY; else process.env.CLAUDE_KIT_REGISTRY = prior;
    rmSync(other, { recursive: true, force: true });
  }
});

rmSync(deco, { recursive: true, force: true });
rmSync(root, { recursive: true, force: true });
rmSync(cache, { recursive: true, force: true });
console.log(`\ncode-index: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
