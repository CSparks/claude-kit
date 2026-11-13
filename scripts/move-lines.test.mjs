// move-lines (KIT-T1155): the verbatim file-split verb. Run: node scripts/move-lines.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, hook, adopted, reporter, tmpDir } from '../hooks/test-harness.mjs';
import { isInertCommand } from '../hooks/lib/inert-command.mjs';
import { moveLines, verify } from './move-lines.mjs';
import { joinLines, parseRanges, planMoves, sortedDiff, splitLines } from './move-lines/plan.mjs';

const { ok, done } = reporter('move-lines');

const sink = () => { const chunks = []; return { write: (s) => chunks.push(s), text: () => chunks.join('') }; };
const run = (args) => { const out = sink(); const err = sink(); const code = moveLines(args, { out, err }); return { code, out: out.text(), err: err.text() }; };
const numbered = (n, eol = '\n') => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join(eol) + eol;

try {
  ok('parseRanges reads singles, spans and lists', JSON.stringify(parseRanges('5, 10-12,20')) === '[[5,5],[10,12],[20,20]]');
  ok('parseRanges refuses a reversed span, zero and words', ['4-2', '0', 'a-b', ''].every((t) => { try { parseRanges(t); return false; } catch { return true; } }));
  const { lines, eol, trailing } = splitLines('a\r\nb\r\nc\r\n');
  ok('splitLines keeps the CRLF style and the trailing break', lines.join() === 'a,b,c' && eol === '\r\n' && trailing && joinLines(lines, eol, trailing) === 'a\r\nb\r\nc\r\n');
  const carve = planMoves(['a', 'b', 'c', 'd', 'e'], [{ ranges: [[4, 5], [1, 1]], dest: 'x' }]);
  ok('planMoves keeps the order of the ranges given and the rest in place', carve.moved.get('x').join() === 'd,e,a' && carve.kept.join() === 'b,c');
  ok('planMoves refuses overlap and a range past the end', ['overlap', 'past'].every((k) => {
    try { planMoves(['a', 'b', 'c'], k === 'overlap' ? [{ ranges: [[1, 2], [2, 3]], dest: 'x' }] : [{ ranges: [[2, 4]], dest: 'x' }]); return false; } catch { return true; }
  }));
  ok('sortedDiff is empty for a reordering and names a changed line', sortedDiff(['b', 'a', 'a'], ['a', 'b', 'a']).length === 0 && sortedDiff(['a', 'b'], ['a', 'c']).join() === '-b,+c');

  const dir = tmpDir('move-lines-');
  const at = (name) => join(dir, name);
  const put = (name, text) => { mkdirSync(join(dir, name, '..'), { recursive: true }); writeFileSync(at(name), text); };
  const read = (name) => readFileSync(at(name), 'utf8');

  put('big.cpp', numbered(10));
  const split = run([at('big.cpp'), '3-5,8=' + at('sub/part.cpp'), '10=' + at('tail.cpp')]);
  ok('a split writes the moved lines verbatim into each new file and removes them from the source',
    split.code === 0 && read('sub/part.cpp') === 'line 3\nline 4\nline 5\nline 8\n' && read('tail.cpp') === 'line 10\n' && read('big.cpp') === 'line 1\nline 2\nline 6\nline 7\nline 9\n', split.err);
  ok('the receipt states the counts and the empty sorted line diff', /moved 5 lines verbatim/.test(split.out) && /10 -> 5 lines/.test(split.out) && /sorted line diff .* is empty/.test(split.out));

  put('keep.cpp', numbered(6));
  const refused = run([at('keep.cpp'), '1-2=' + at('tail.cpp')]);
  ok('negative control: an existing destination is refused without --append and nothing changes', refused.code === 1 && /--append/.test(refused.err) && read('keep.cpp') === numbered(6) && read('tail.cpp') === 'line 10\n');
  const appended = run(['--append', at('keep.cpp'), '1-2=' + at('tail.cpp')]);
  ok('--append adds the lines at the end of the existing file', appended.code === 0 && read('tail.cpp') === 'line 10\nline 1\nline 2\n' && read('keep.cpp') === 'line 3\nline 4\nline 5\nline 6\n');

  put('dry.cpp', numbered(4));
  const dry = run(['--dry-run', at('dry.cpp'), '1-2=' + at('dry-out.cpp')]);
  ok('--dry-run reports the plan and writes nothing', dry.code === 0 && /dry run/.test(dry.out) && read('dry.cpp') === numbered(4) && run(['--dry-run', at('dry.cpp'), '1=' + at('tail.cpp')]).code === 1);

  put('over.cpp', numbered(5));
  const overlap = run([at('over.cpp'), '1-3=' + at('o1.cpp'), '3-4=' + at('o2.cpp')]);
  ok('negative control: overlapping ranges write nothing', overlap.code === 1 && read('over.cpp') === numbered(5) && run([at('over.cpp'), '4-9=' + at('o3.cpp')]).code === 1);

  put('crlf.cpp', numbered(4, '\r\n'));
  run([at('crlf.cpp'), '2-3=' + at('crlf-out.cpp')]);
  ok('a CRLF source stays CRLF in both files', read('crlf.cpp') === 'line 1\r\nline 4\r\n' && read('crlf-out.cpp') === 'line 2\r\nline 3\r\n');

  put('huge.cpp', numbered(700));
  const huge = run([at('huge.cpp'), '1-650=' + at('huge-out.cpp')]);
  ok('negative control: a destination over the hard file-length limit is refused', huge.code === 1 && /hard limit/.test(huge.err) && read('huge.cpp') === numbered(700));
  ok('a 700-line source split into two destinations under the limit is accepted', run([at('huge.cpp'), '1-350=' + at('huge-a.cpp'), '351-700=' + at('huge-b.cpp')]).code === 0);

  put('proof-src.cpp', 'a\nb\n');
  put('proof-dst.cpp', 'a\nb\nXX\n');
  ok('verify names a difference when the moved lines do not account for the source', /not empty/.test(verify(['a', 'b', 'c'], at('proof-src.cpp'), [], [])) && verify(['a', 'b'], at('proof-src.cpp'), [], []) === '');
  ok('verify catches a changed line of an appended destination', /existing lines changed/.test(verify(['a', 'b'], at('proof-src.cpp'), [{ dest: at('proof-dst.cpp'), before: ['a', 'Z'] }], [])));

  const repo = adopted(false);
  const verb = `node scripts/move-lines.mjs src/big.cpp 1-300=src/part.cpp`;
  ok('the shell gate lets the kit verb through', hook('source-shell-gate.mjs', { tool_name: 'Bash', tool_input: { command: verb } }, repo).code === 0);
  ok('the verb is inert to the hand-write detector, so the call is not blamed for a changed file', isInertCommand(verb, { root: repo }));
  ok('negative control: a redirect that writes the same source file is still refused', hook('source-shell-gate.mjs', { tool_name: 'Bash', tool_input: { command: 'cat src/big.cpp > src/part.cpp' } }, repo).code === 2);
  ok('negative control: a node scratch script is not the kit verb', !isInertCommand('node slice.mjs src/big.cpp', { root: repo }));
} finally {
  cleanup();
}

done();
