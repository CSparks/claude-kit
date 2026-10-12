// capability-research.test.mjs — KIT-T433: the graded per-job capability note that gates a refresh and a row re-date.
// Run: node scripts/capability-research.test.mjs

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseCapabilityNote, isGraded, capabilityCoverage, capabilityNotePath } from './capability-research.mjs';
import { KIT_ROOT } from './dispatch-ladder.mjs';
import { cleanup, reporter, fixtureKit, capabilityNote } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('capability-research');

try {
  const rows = parseCapabilityNote(['intro', '| Job | Verdict | Basis |', '|---|---|---|', '| fix | Sonnet | A, B |', '| `wiring` | Sonnet | inference |', '', '| other | x |', '| fix | y |'].join('\n'));
  ok('the Job and Basis columns parse into a row map', rows.fix === 'A, B' && rows.wiring === 'inference');
  ok('a table without Job and Basis columns is ignored', Object.keys(rows).length === 2);
  ok('A, B, C grades count; none and inference do not', ['A', 'B/C', 'C (unverified)', 'A, B'].every(isGraded) && !['none', 'inference', '', undefined].some(isGraded));

  const kit = fixtureKit('2026-10-12');
  ok('no note: nothing exists and every row is missing', capabilityCoverage(kit, '2026-10-12').exists === false && capabilityCoverage(kit, '2026-10-12').missing.length > 5);
  capabilityNote(kit, '2026-10-12', { omit: ['deep'], ungraded: ['asset'] });
  const cov = capabilityCoverage(kit, '2026-10-12');
  ok('coverage lists an omitted row and an ungraded row as missing', cov.exists && cov.missing.join() === 'asset,deep' && cov.covered.includes('fix'));
  ok('coverage can be narrowed to named jobs', capabilityCoverage(kit, '2026-10-12', ['fix']).missing.length === 0);
  ok('the note path is dated under research/', capabilityNotePath(kit, '2026-10-12') === join(kit, 'research', 'models-capability-2026-10-12.md'));

  const live = capabilityCoverage(KIT_ROOT, '2026-10-12');
  ok('the live 2026-10-12 note grades every dispatch.jobs row (research plus the maintainer approval table)', existsSync(live.file) && live.missing.length === 0);
} finally {
  cleanup();
}
done();
