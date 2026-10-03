// Tests for the comment checks (KIT-T283, folding KIT-T207): the pre-write gate blocks oversized
// comment blocks and discussion-narrating comments, warns on long ones, honours the standard
// exclusions; the sweep reports the worst files. Run: node hooks/comment-gate.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';

process.env.KIT_USER = 'Pat'; // the configured maintainer alias the attribution check keys on
const { commentRuns, narrationHits, commentStats, RUN_WARN, RUN_BLOCK } = await import('./lib/comment-scan.mjs');
const { sweepComments } = await import('../scripts/comment-sweep.mjs');

const { ok, done } = reporter('comment-gate');

const block = (n, prefix = '//') => Array.from({ length: n }, (_, i) => `${prefix} contract line ${i}`).join('\n');
const code = (comment) => `${comment}\nexport const answer = () => 1;\n`;
const write = (cwd, rel, content) => hook('pre-write.mjs', { tool_input: { file_path: join(cwd, rel), content } }, cwd, { KIT_USER: 'Pat' });

try {
  const d = realpathSync.native(adopted(false)); // git reports the long path form

  // --- length ---------------------------------------------------------------------
  ok('a short contract comment passes silently', (() => { const r = write(d, 'a.mjs', code(block(RUN_WARN))); return r.code === 0 && !/comment/i.test(r.out); })());
  const warn = write(d, 'b.mjs', code(block(RUN_WARN + 2)));
  ok('a comment block over the warn line count warns and still passes', warn.code === 0 && /Long comment block/.test(warn.out));
  const hard = write(d, 'c.mjs', code(block(RUN_BLOCK + 2)));
  ok('a comment block over the hard line count blocks and names the check', hard.code === 2 && /comment-length/.test(hard.out));
  ok('hash-comment blocks count too (python)', write(d, 'd.py', `${block(RUN_BLOCK + 2, '#')}\nx = 1\n`).code === 2);
  ok('block comments (/* */) count too', write(d, 'e.ts', `/*\n${Array.from({ length: RUN_BLOCK + 2 }, (_, i) => ` * line ${i}`).join('\n')}\n */\nexport const a = 1;\n`).code === 2);
  ok('a blank line splits runs, so two short blocks pass', write(d, 'f.mjs', `${block(RUN_WARN)}\n\n${block(RUN_WARN)}\nexport const z = 1;\n`).code === 0);
  ok('a license header at the top is exempt', write(d, 'g.mjs', `${block(RUN_BLOCK + 2).replace('contract line 0', 'Copyright (c) the authors')}\nexport const z = 1;\n`).code === 0);

  // --- narration (KIT-T207) ---------------------------------------------------------
  const dated = write(d, 'h.mjs', code('// measured on 2026-06-06, the fastnoise relitigation'));
  ok('a dated stamp in a comment blocks', dated.code === 2 && /comment-narration/.test(dated.out));
  ok('maintainer attribution blocks', write(d, 'i.mjs', code('// Pat said we should never do this')).code === 2);
  ok('quoted discussion blocks', write(d, 'j.mjs', code('// he asked: "why is this here"')).code === 2);
  ok('profanity blocks', write(d, 'k.mjs', code('// this is crap but works')).code === 2);
  ok('a bare ticket id in a comment passes', write(d, 'l.mjs', code('// Rounds toward zero (KIT-T207).')).code === 0);
  ok('a why-comment with no history passes', write(d, 'm.mjs', code('// Sorted by id so the cache and the scan agree.')).code === 0);
  ok('the same words in CODE (a string) are not comments', write(d, 'n.mjs', "export const s = 'Pat said hi 2026-01-01';\n").code === 0);

  // --- exclusions ---------------------------------------------------------------------
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'comment-length:\n  - "long/**"\ncomment-narration:\n  - "story/**"\n');
  ok('path exclusion lifts comment-length', write(d, 'long/a.mjs', code(block(RUN_BLOCK + 2))).code === 0);
  ok('path exclusion lifts comment-narration', write(d, 'story/a.mjs', code('// Pat said so 2026-01-01')).code === 0);
  ok('in-source marker lifts a narrating line',
    write(d, 'o.mjs', code('// claude-kit-ignore-start comment-narration\n// Pat said so\n// claude-kit-ignore-end')).code === 0);

  // --- ticket-id backstory (KIT-D078) ---------------------------------------------------
  ok('a sentence recounting ticket history blocks', write(d, 'q1.mjs', code('// ST-T123 moved this into the loader')).code === 2);
  ok('"since <id> the ..." blocks', write(d, 'q2.mjs', code('// since ST-T456 the cache is rebuilt on start')).code === 2);
  ok('"was ... in <id>" blocks', write(d, 'q3.mjs', code('// this was a plain loop in KIT-D012')).code === 2);
  ok('a bare id and a fix-for reference pass', write(d, 'q4.mjs', code('// Workaround for ST-T123; see KIT-D078.')).code === 0);
  ok('a verb with no ticket id passes', write(d, 'q5.mjs', code('// moved to the loader so the cache stays warm')).code === 0);

  // --- TOML comments --------------------------------------------------------------------
  ok('a long TOML comment block blocks', write(d, 'Cargo.toml', `${block(RUN_BLOCK + 2, '#')}\n[package]\nname = "x"\n`).code === 2);
  ok('a long comment block in .cargo/config.toml blocks', write(d, '.cargo/config.toml', `${block(RUN_BLOCK + 2, '#')}\n[build]\njobs = 3\n`).code === 2);
  ok('TOML ticket-history narration blocks', write(d, 'a/Cargo.toml', '# since ST-T9 this crate owns the cache\n[package]\nname = "x"\n').code === 2);
  ok('a short TOML comment passes', write(d, 'b/Cargo.toml', '# the crate name\n[package]\nname = "x"\n').code === 0);
  ok('other config (json) is still not scanned', write(d, 'x.json', '{"a": 1}\n').code === 0);

  // --- ratio on a whole-file Write ----------------------------------------------------
  const chatty = Array.from({ length: 30 }, (_, i) => `// note ${i}\nexport const v${i} = ${i % 2};`).join('\n\n');
  ok('a comment-heavy whole file warns on ratio', /% of this file/.test(write(d, 'p.mjs', chatty + '\n').out));

  // --- scanner units --------------------------------------------------------------------
  ok('commentRuns groups consecutive lines', commentRuns('// a\n// b\nx\n// c\n', 'mjs').map((r) => r.length).join() === '2,1');
  ok('narrationHits ignores code lines', narrationHits("const a = 'Pat said x';\n", 'mjs').length === 0);
  ok('commentStats reports ratio and longest', (() => { const s = commentStats('// a\n// b\nx\ny\n', 'mjs'); return s.comment === 2 && s.longest === 2 && s.ratio === 0.5; })());

  // --- sweep --------------------------------------------------------------------------------
  const root = mkdtempSync(join(tmpdir(), 'sweep-'));
  for (const [rel, text] of Object.entries({ 'a/big.mjs': code(block(12)), 'a/small.mjs': code('// one'), 'a/story.mjs': code('// Pat said so') })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  const sweep = sweepComments(root);
  ok('sweep ranks the heaviest file first', sweep.files[0].path === 'a/big.mjs' && sweep.files[0].comment === 12);
  ok('sweep reports the longest block', sweep.blocks[0].path === 'a/big.mjs' && sweep.blocks[0].length === 12);
  ok('sweep lists narrating comments', sweep.narration.length === 1 && sweep.narration[0].path === 'a/story.mjs');
  mkdirSync(join(root, 'cfg'), { recursive: true });
  writeFileSync(join(root, 'cfg/Cargo.toml'), '# ST-T5 moved the jobs setting here\n# a plain note\n[build]\njobs = 3\n');
  writeFileSync(join(root, 'cfg/data.json'), '{"a": 1}\n');
  const withToml = sweepComments(root);
  ok('sweep covers TOML comments and ticket narration', withToml.files.some((f) => f.path === 'cfg/Cargo.toml' && f.comment === 2) && withToml.narration.some((n) => n.path === 'cfg/Cargo.toml'));
  ok('sweep still ignores json', !withToml.files.some((f) => f.path === 'cfg/data.json'));
  rmSync(root, { recursive: true, force: true });
} finally {
  cleanup();
}
done();
