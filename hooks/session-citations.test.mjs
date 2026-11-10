// session-citations (KIT-T215, KIT-T926): the dead-citation warning fires on a path a live entry cites and the
// disk lacks, and it is satisfiable: a line that calls the path stale, renamed or gone clears it, and dated
// entries past the newest few are history. Fixture lines are copied from the groovegrid anchor that warned every
// turn about six paths.
// Run: node hooks/session-citations.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, reporter, tmpDir } from './test-harness.mjs';
import { citedPaths, missingCitations } from './session-citations.mjs';

const { ok, done } = reporter('session-citations');

const SIX = ['GroupPads/PadSettings/.old', 'tests/test_GroupPads.cpp', 'src/ui/tracks/TrackPanelChoke.cpp',
  'src/ui/tracks/PadSettings.h/.cpp', 'PadSettings.h/.cpp', '.old/.old2'];

const L20 = '- [2026-11-07 16:26] 2026-11-07 GG-D049 recorded (amends GG-D048): collapsed Scene row center = horizontally scrolling scene list. Stale SESSION.md path citations (GroupPads/PadSettings/.old) pre-existing, untouched.';
const L30 = '- [2026-11-04 23:48] 2026-11-04: GG-T159 landed 583862fd (src/state/GroupPads.*, tests/test_GroupPads.cpp, 4 cases green). Blocked: 17th-child guard awaits Chris on split.';
const L234 = '2026-11-05: ec6b004e choke dropdown (src/ui/tracks/TrackPanelChoke.cpp) + audio-thread src/plugin/ChokeTable.h. Drum Group tests: tests/test_DrumGroup.cpp (test_GroupPads.cpp no longer exists). Open: choke with kits GG-T163.';
const L236 = '2026-11-05: pad editor moved: src/ui/tracks/PadSettings.h/.cpp and PadSettings.h/.cpp are the old homes.';
const L240 = '2026-11-05: GG-D042 clarified (Chris). Next unchanged: Bake questions to Chris. Stale citations (tests/test_GroupPads.cpp, TrackPanelChoke.cpp, PadSettings.h/.cpp) are other sessions\' Group Pads work, not re-anchored.';
const L382 = '2026-11-05: exe still locked by 5 unkillable exit-hang processes; renamed exe to GrooveGrid.exe.stuck-exit-hang. GG-T182 note: recurring hang (earlier .old/.old2 renames).';

try {
  const root = tmpDir('citations-');
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(join(root, 'tests', 'test_DrumGroup.cpp'), '');
  mkdirSync(join(root, 'src', 'plugin'), { recursive: true });
  writeFileSync(join(root, 'src', 'plugin', 'ChokeTable.h'), '');
  const anchor = (...lines) => `# SESSION\n\n## Now\n\n${lines.join('\n')}\n`;

  const missing = (text) => missingCitations(root, text);
  ok('control: with no stale marker all six paths are reported', SIX.every((p) => missing(anchor(...SIX.map((x) => `2026-11-05 note cites ${x}`))).includes(p)));

  const whole = anchor(L20, L30, L234, L236, L240, L382);
  ok('the groovegrid anchor (lines 20, 30, 234, 236, 240, 382) reports nothing', missing(whole).length === 0);
  ok('control: dropping the markers brings the six paths back', missing(anchor(L20.replace('Stale', 'Live'), L30, L234.replace('no longer exists', 'exists'), L236, L240.replace(/Stale/, 'Live'), L382.replace('renames', 'copies'))).length > 0);

  ok('a path another line declares stale is cleared wherever it is cited', missing(anchor('2026-11-09: wrote tests/missing/a.cpp', '2026-11-09: tests/missing/a.cpp is stale, dropped')).length === 0);
  ok('a bare file name declared stale clears the full path that ends with it', missing(anchor('src/ui/Gone.cpp is the file', 'Gone.cpp was renamed to Here.cpp')).length === 0);
  ok('control: a dead citation no line calls stale is still reported', missing(anchor('2026-11-09: deliverable at docs/research/lost.md')).includes('docs/research/lost.md'));

  const dated = (n) => `- [2026-10-${String(10 + n).padStart(2, '0')} 12:00] entry ${n} cites docs/old${n}.md`;
  const entries = Array.from({ length: 14 }, (_, i) => dated(14 - i));
  const found = missing(anchor(...entries));
  ok('only the newest dated entries are checked', found.includes('docs/old14.md') && found.includes('docs/old5.md') && !found.includes('docs/old1.md'));
  ok('control: an undated line is always checked', missing(anchor(...entries, 'plain line cites docs/undated.md')).includes('docs/undated.md'));
  ok('citedPaths still lists every path-shaped token', citedPaths(anchor(L30)).includes('tests/test_GroupPads.cpp'));
} finally {
  cleanup();
}

done();
