// move-lines (KIT-T1155, KIT-T1159): the verbatim file-split verb and the guard on the files it may touch.
// Run: node scripts/move-lines.test.mjs

import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, adopted, cleanup, git, hook, identify, reporter, tmpDir } from '../hooks/test-harness.mjs';
import { isInertCommand } from '../hooks/lib/inert-command.mjs';
import { moveLinesCall } from '../hooks/lib/move-lines-call.mjs';
import { slashed } from '../hooks/lib/source-path.mjs';
import { kitLed } from '../hooks/lib/shell-write-scan.mjs';
import { shellSourceWrites } from '../hooks/lib/shell-source-write.mjs';
import { moveLines, verify } from './move-lines.mjs';
import { joinLines, parseRanges, planMoves, sortedDiff, splitLines } from './move-lines/plan.mjs';

const { ok, done } = reporter('move-lines');

const sink = () => { const chunks = []; return { write: (s) => chunks.push(s), text: () => chunks.join('') }; };
const numbered = (n, eol = '\n') => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join(eol) + eol;
const KIT_SCRIPT = slashed(join(ROOT, 'scripts', 'move-lines.mjs'));

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

  const state = tmpDir('move-lines-state-');
  process.env.CLAUDE_KIT_TURN_STATE = state;
  const dir = identify(adopted(false));
  const outside = tmpDir('move-lines-outside-');
  const at = (name) => join(dir, name);
  const put = (name, text) => { mkdirSync(join(dir, name, '..'), { recursive: true }); writeFileSync(at(name), text); };
  const tracked = (name, text) => { put(name, text); git(['add', '--', name], dir); };
  const read = (name) => readFileSync(at(name), 'utf8');
  const run = (args, where = dir) => { const out = sink(); const err = sink(); const code = moveLines(args, { out, err, cwd: where }); return { code, out: out.text(), err: err.text() }; };

  tracked('big.cpp', numbered(10));
  const split = run([at('big.cpp'), '3-5,8=' + at('sub/part.cpp'), '10=' + at('tail.cpp')]);
  ok('a split writes the moved lines verbatim into each new file and removes them from the source',
    split.code === 0 && read('sub/part.cpp') === 'line 3\nline 4\nline 5\nline 8\n' && read('tail.cpp') === 'line 10\n' && read('big.cpp') === 'line 1\nline 2\nline 6\nline 7\nline 9\n', split.err);
  ok('the receipt states the counts and the empty sorted line diff', /moved 5 lines verbatim/.test(split.out) && /10 -> 5 lines/.test(split.out) && /sorted line diff .* is empty/.test(split.out));
  tracked('rel.cpp', numbered(3));
  const relative = run(['rel.cpp', '1=out/rel-part.cpp']);
  ok('a relative source and destination resolve against the cwd', relative.code === 0 && read('out/rel-part.cpp') === 'line 1\n', relative.err);

  tracked('keep.cpp', numbered(6));
  const refused = run([at('keep.cpp'), '1-2=' + at('tail.cpp')]);
  ok('negative control: an existing destination is refused without --append and nothing changes', refused.code === 1 && /--append/.test(refused.err) && read('keep.cpp') === numbered(6) && read('tail.cpp') === 'line 10\n');
  const appended = run(['--append', at('keep.cpp'), '1-2=' + at('tail.cpp')]);
  ok('--append adds the lines at the end of the existing file', appended.code === 0 && read('tail.cpp') === 'line 10\nline 1\nline 2\n' && read('keep.cpp') === 'line 3\nline 4\nline 5\nline 6\n');

  tracked('dry.cpp', numbered(4));
  const dry = run(['--dry-run', at('dry.cpp'), '1-2=' + at('dry-out.cpp')]);
  ok('--dry-run reports the plan and writes nothing', dry.code === 0 && /dry run/.test(dry.out) && read('dry.cpp') === numbered(4) && run(['--dry-run', at('dry.cpp'), '1=' + at('tail.cpp')]).code === 1);

  tracked('over.cpp', numbered(5));
  const overlap = run([at('over.cpp'), '1-3=' + at('o1.cpp'), '3-4=' + at('o2.cpp')]);
  ok('negative control: overlapping ranges write nothing', overlap.code === 1 && read('over.cpp') === numbered(5) && run([at('over.cpp'), '4-9=' + at('o3.cpp')]).code === 1);

  tracked('crlf.cpp', numbered(4, '\r\n'));
  run([at('crlf.cpp'), '2-3=' + at('crlf-out.cpp')]);
  ok('a CRLF source stays CRLF in both files', read('crlf.cpp') === 'line 1\r\nline 4\r\n' && read('crlf-out.cpp') === 'line 2\r\nline 3\r\n');

  tracked('huge.cpp', numbered(700));
  const huge = run([at('huge.cpp'), '1-650=' + at('huge-out.cpp')]);
  ok('negative control: a destination over the hard file-length limit is refused', huge.code === 1 && /hard limit/.test(huge.err) && read('huge.cpp') === numbered(700));
  ok('a 700-line source split into two destinations under the limit is accepted', run([at('huge.cpp'), '1-350=' + at('huge-a.cpp'), '351-700=' + at('huge-b.cpp')]).code === 0);

  put('proof-src.cpp', 'a\nb\n');
  put('proof-dst.cpp', 'a\nb\nXX\n');
  ok('verify names a difference when the moved lines do not account for the source', /not empty/.test(verify(['a', 'b', 'c'], at('proof-src.cpp'), [], [])) && verify(['a', 'b'], at('proof-src.cpp'), [], []) === '');
  ok('verify catches a changed line of an appended destination', /existing lines changed/.test(verify(['a', 'b'], at('proof-src.cpp'), [{ dest: at('proof-dst.cpp'), before: ['a', 'Z'] }], [])));

  tracked('g.cpp', numbered(6));
  const refuses = (name, args, pattern, where = dir) => {
    const r = run(args, where);
    ok(`negative control: ${name}`, r.code === 1 && pattern.test(r.err) && read('g.cpp') === numbered(6), r.err.trim());
  };
  writeFileSync(join(outside, 'far.cpp'), numbered(4));
  refuses('a source outside the git root is refused', [join(outside, 'far.cpp'), '1=' + at('far-part.cpp')], /outside the git root/);
  ok('the outside source is unchanged', readFileSync(join(outside, 'far.cpp'), 'utf8') === numbered(4));
  refuses('a destination outside the git root is refused', [at('g.cpp'), '1=' + join(outside, 'leak.cpp')], /outside the git root/);
  refuses('a dry run is refused the same way', ['--dry-run', at('g.cpp'), '1=' + join(outside, 'leak.cpp')], /outside the git root/);
  put('fresh.cpp', numbered(4));
  const untracked = run([at('fresh.cpp'), '1=' + at('fresh-part.cpp')]);
  ok('negative control: a source git does not track and no tool wrote is refused', untracked.code === 1 && /neither tracked/.test(untracked.err) && read('fresh.cpp') === numbered(4));
  refuses('a destination that is not a source path is refused', [at('g.cpp'), '1=' + at('notes.txt')], /not a hand-authored source path/);
  refuses('a destination under build output is refused', [at('g.cpp'), '1=' + at('build/gen.cpp')], /not a hand-authored source path/);
  refuses('a destination under .git is refused', [at('g.cpp'), '1=' + at('.git/hooks/pre.sh')], /not a hand-authored source path/);
  refuses('a destination in a project hook or config directory is refused', [at('g.cpp'), '1=' + at('.claude/hooks/x.mjs')], /hook, config or settings/);
  refuses('a destination under .ai is refused', [at('g.cpp'), '1=' + at('.ai/x.mjs')], /hook, config or settings/);

  const kit = identify(adopted(false));
  writeFileSync(join(kit, 'package.json'), '{"name":"claude-kit"}\n');
  mkdirSync(join(kit, 'hooks'), { recursive: true });
  writeFileSync(join(kit, 'hooks', 'gate.mjs'), numbered(4));
  writeFileSync(join(kit, 'lib.mjs'), numbered(4));
  git(['add', '--', 'hooks/gate.mjs', 'lib.mjs'], kit);
  const hookMove = run([join(kit, 'lib.mjs'), '1=' + join(kit, 'hooks', 'part.mjs')], kit);
  ok('negative control: a destination among the kit\'s own hook files is refused', hookMove.code === 1 && /hook, config or settings/.test(hookMove.err), hookMove.err.trim());
  ok('negative control: a source among the kit\'s own hook files is refused', run([join(kit, 'hooks', 'gate.mjs'), '1=' + join(kit, 'gate-part.mjs')], kit).code === 1);
  ok('a file of the same repo outside hooks still moves', run([join(kit, 'lib.mjs'), '1=' + join(kit, 'lib-part.mjs')], kit).code === 0);

  const linked = (target, link, type) => { try { symlinkSync(target, link, type); return true; } catch { return false; } };
  put('real.cpp', numbered(2));
  mkdirSync(at('realdir'), { recursive: true });
  if (linked(at('real.cpp'), at('linked.cpp'), 'file')) refuses('a destination that is a symlink is refused', [at('g.cpp'), '1=' + at('linked.cpp'), '--append'], /symlink/);
  if (linked(at('realdir'), at('linkdir'), 'junction')) refuses('a destination behind a symlinked directory is refused', [at('g.cpp'), '1=' + at('linkdir/part.cpp')], /symlink/);

  const writer = (rel, text) => {
    const payload = { session_id: 'S1', tool_input: { file_path: at(rel), content: text } };
    put(rel, text);
    hook('pre-write.mjs', payload, dir, { CLAUDE_KIT_TURN_STATE: state });
    hook('tool-write-record.mjs', payload, dir, { CLAUDE_KIT_TURN_STATE: state });
  };
  writer('written.cpp', numbered(5));
  const ledgered = run([at('written.cpp'), '1-2=' + at('written-part.cpp')]);
  ok('a source an Edit or Write tool left as it is moves although git does not track it', ledgered.code === 0 && read('written-part.cpp') === 'line 1\nline 2\n', ledgered.err.trim());
  writer('written2.cpp', numbered(5));
  put('written2.cpp', numbered(5) + 'changed after the tool\n');
  ok('negative control: the same file changed by hand after the tool is refused', run([at('written2.cpp'), '1=' + at('written2-part.cpp')]).code === 1);

  tracked('src/gate.cpp', numbered(8));
  const impostor = join(tmpDir('move-lines-impostor-'), 'move-lines.mjs');
  writeFileSync(impostor, "import { writeFileSync } from 'node:fs';\nwriteFileSync('src/gate.cpp', '');\n");
  const verb = 'move-lines src/gate.cpp 1-3=src/gate-part.cpp';
  const fresh = 'move-lines src/fresh-new.cpp 1=src/x.cpp';
  const call = (command) => moveLinesCall(command, dir);
  ok('the bare verb with a tracked source and in-repo destinations is the kit verb', call(verb).problem === '');
  ok('node on the kit script is the kit verb too', call(`node ${KIT_SCRIPT} src/gate.cpp 1-3=src/gate-part.cpp`).problem === '');
  ok('a command that names no move-lines is no call', moveLinesCall('q code move', dir) === null && moveLinesCall('git status', dir) === null);
  ok('negative control: a source outside the repo is no kit verb', call(`move-lines ${slashed(join(outside, 'far.cpp'))} 1=src/x.cpp`).problem !== '');
  ok('negative control: an untracked source is no kit verb', call(fresh).problem !== '');
  ok('negative control: a destination that is not a source path is no kit verb', call('move-lines src/gate.cpp 1=src/notes.txt').problem !== '');
  ok('negative control: a hook or config destination is no kit verb', call('move-lines src/gate.cpp 1=.claude/hooks/x.mjs').problem !== '');
  ok('negative control: a scratch script named move-lines.mjs is no kit verb', call(`node ${slashed(impostor)} src/gate.cpp 1-3=src/gate-part.cpp`).problem !== '');
  ok('negative control: a program at a path named move-lines is no kit verb', call('./move-lines src/gate.cpp 1-3=src/gate-part.cpp').problem !== '');
  ok('negative control: a malformed argument line is no kit verb', call('move-lines src/gate.cpp').problem !== '');
  ok('kitLed follows the guard', kitLed(verb, dir) && !kitLed(fresh, dir) && kitLed('q code x', dir));

  const scan = (command) => shellSourceWrites(command, { tempDir: tmpDir('move-lines-not-temp-') });
  const here = process.cwd();
  process.chdir(dir);
  try {
    ok('the scan lets the verb through with arguments the guard accepts', scan(verb).length === 0);
    ok('negative control: the scan refuses a source the guard rejects', scan(fresh).length > 0 && scan(`move-lines ${slashed(join(outside, 'far.cpp'))} 1=src/x.cpp`).length > 0);
    ok('negative control: the scan judges a scratch script named move-lines.mjs by what it writes', scan(`node ${slashed(impostor)} src/gate.cpp 1-3=src/gate-part.cpp`).length > 0);
    ok('negative control: a redirect that writes the same source file is still refused', scan('cat src/gate.cpp > src/gate-part.cpp').length > 0);
    ok('negative control: a redirect after the verb is still judged', scan(`${verb} > src/gate.cpp`).length > 0);
  } finally {
    process.chdir(here);
  }
  const gate = (command) => hook('source-shell-gate.mjs', { tool_name: 'Bash', tool_input: { command } }, dir);
  ok('the shell gate lets the kit verb through', gate(verb).code === 0);
  ok('negative control: the shell gate refuses a scratch script named move-lines.mjs that writes the source', gate(`node ${slashed(impostor)} src/gate.cpp 1-3=src/gate-part.cpp`).code === 2);
  ok('negative control: the shell gate still refuses a redirect that writes the same source file', gate('cat src/gate.cpp > src/gate-part.cpp').code === 2);

  ok('the verb is inert to the hand-write detector, so the call is not blamed for a changed file', isInertCommand(verb, { root: dir }));
  ok('negative control: a node scratch script is not the kit verb', !isInertCommand('node slice.mjs src/gate.cpp', { root: dir }));
  ok('negative control: a scratch script named move-lines.mjs is not inert', !isInertCommand(`node ${slashed(impostor)} src/gate.cpp 1-3=src/gate-part.cpp`, { root: dir }));
  ok('negative control: a move-lines call the guard rejects is not inert', !isInertCommand(fresh, { root: dir }));
} finally {
  cleanup();
}

done();
