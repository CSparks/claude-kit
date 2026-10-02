// Tests for the comment checks (KIT-T283, folding KIT-T207): the pre-write gate blocks oversized
// comment blocks and discussion-narrating comments, warns on long ones, honours the standard
// exclusions; the sweep reports the worst files. Run: node hooks/comment-gate.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { commentRuns, narrationHits, commentStats, RUN_WARN, RUN_BLOCK } from './lib/comment-scan.mjs';
import { sweepComments } from '../scripts/comment-sweep.mjs';

const { ok, done } = reporter('comment-gate');

const block = (n, prefix = '//') => Array.from({ length: n }, (_, i) => `${prefix} contract line ${i}`).join('\n');
const code = (comment) => `${comment}\nexport const answer = () => 1;\n`;
const write = (cwd, rel, content) => hook('pre-write.mjs', { tool_input: { file_path: join(cwd, rel), content } }, cwd);

try {
  const d = adopted(false);

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
  ok('maintainer attribution blocks', write(d, 'i.mjs', code('// Chris said we should never do this')).code === 2);
  ok('quoted discussion blocks', write(d, 'j.mjs', code('// he asked: "why is this here"')).code === 2);
  ok('profanity blocks', write(d, 'k.mjs', code('// this is crap but works')).code === 2);
  ok('a bare ticket id in a comment passes', write(d, 'l.mjs', code('// Rounds toward zero (KIT-T207).')).code === 0);
  ok('a why-comment with no history passes', write(d, 'm.mjs', code('// Sorted by id so the cache and the scan agree.')).code === 0);
  ok('the same words in CODE (a string) are not comments', write(d, 'n.mjs', "export const s = 'Chris said hi 2026-01-01';\n").code === 0);

  // --- exclusions ---------------------------------------------------------------------
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'comment-length:\n  - "long/**"\ncomment-narration:\n  - "story/**"\n');
  ok('path exclusion lifts comment-length', write(d, 'long/a.mjs', code(block(RUN_BLOCK + 2))).code === 0);
  ok('path exclusion lifts comment-narration', write(d, 'story/a.mjs', code('// Chris said so 2026-01-01')).code === 0);
  ok('in-source marker lifts a narrating line',
    write(d, 'o.mjs', code('// claude-kit-ignore-start comment-narration\n// Chris said so\n// claude-kit-ignore-end')).code === 0);

  // --- ratio on a whole-file Write ----------------------------------------------------
  const chatty = Array.from({ length: 30 }, (_, i) => `// note ${i}\nexport const v${i} = ${i % 2};`).join('\n\n');
  ok('a comment-heavy whole file warns on ratio', /% of this file/.test(write(d, 'p.mjs', chatty + '\n').out));

  // --- scanner units --------------------------------------------------------------------
  ok('commentRuns groups consecutive lines', commentRuns('// a\n// b\nx\n// c\n', 'mjs').map((r) => r.length).join() === '2,1');
  ok('narrationHits ignores code lines', narrationHits("const a = 'Chris said x';\n", 'mjs').length === 0);
  ok('commentStats reports ratio and longest', (() => { const s = commentStats('// a\n// b\nx\ny\n', 'mjs'); return s.comment === 2 && s.longest === 2 && s.ratio === 0.5; })());

  // --- sweep --------------------------------------------------------------------------------
  const root = mkdtempSync(join(tmpdir(), 'sweep-'));
  for (const [rel, text] of Object.entries({ 'a/big.mjs': code(block(12)), 'a/small.mjs': code('// one'), 'a/story.mjs': code('// Chris said so') })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  const sweep = sweepComments(root);
  ok('sweep ranks the heaviest file first', sweep.files[0].path === 'a/big.mjs' && sweep.files[0].comment === 12);
  ok('sweep reports the longest block', sweep.blocks[0].path === 'a/big.mjs' && sweep.blocks[0].length === 12);
  ok('sweep lists narrating comments', sweep.narration.length === 1 && sweep.narration[0].path === 'a/story.mjs');
  rmSync(root, { recursive: true, force: true });
} finally {
  cleanup();
}
done();
