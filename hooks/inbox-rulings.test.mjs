// inbox-rulings (KIT-T938): what reads as a maintainer ruling, which notes are un-promoted, how a Stop separates this
// turn's rulings from older ones, and what clears one.
// Run: node hooks/inbox-rulings.test.mjs

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, reporter } from './test-harness.mjs';
import { isRuling, pendingNotes, resolveInboxNotes, rulingLines, unpromotedRulings } from './lib/inbox-rulings.mjs';
import { freshRulings, rulingStop } from './lib/ruling-stop.mjs';
import { NOT_RULINGS, REAL_RULINGS, seedInbox } from './inbox-rulings-fixtures.mjs';
import { recordDecision } from '../scripts/t-decide.mjs';
import { triageCapture } from '../scripts/t-triage.mjs';

const { ok, done } = reporter('inbox-rulings');
const USER = 'chris';
const HALF_HOUR_S = 1800;
const DRAFT = '---\ntitle: Scene metadata lives in the scene\nsummary: s\nsource: chat\n---\n\n**Decision:** the scene owns it.\n\n**Why:** chat.\n';

const seedInboxed = () => {
  const d = adopted(false);
  seedInbox(d, [{ file: '2026-11-09-0900-typed.md', text: '(note) Song mode ruling (Chris 2026-11-09, verbatim): scenes own their values\n' }]);
  return d;
};

try {
  for (const r of REAL_RULINGS) ok(`the real note ${r.file.slice(0, 20)} reads as a ruling`, isRuling(r.text, USER));
  for (const n of NOT_RULINGS) ok(`negative control: ${n.name} is no ruling`, !isRuling(n.text, USER));
  ok('the maintainer named with a said verb is a ruling', isRuling('note Chris said the roles modal opens from the toolbar', USER));
  ok('a dated name tag is a ruling', isRuling('note Song mode layout (Chris 2026-11-05) floats the strip', USER));
  ok('the word directive is a ruling', isRuling('note a standing directive about triage', USER));
  ok('a five-word quoted sentence in an untyped note is a ruling', isRuling("note on motifs: 'We need a way to store and name them.'", USER));
  ok('a four-word quote is not', !isRuling("note he said nothing but 'maybe later, not now'", ''));
  ok('another user name does not match the maintainer rule', !isRuling('note Dana said hello to the build', USER));
  ok('the maintainer role without a speech verb is no ruling', !isRuling('note the maintainer checklist lives in docs', USER));

  const repo = adopted(false);
  const files = seedInbox(repo, [...REAL_RULINGS, ...NOT_RULINGS.map((n, i) => ({ file: `2026-11-09-10${i}0-n${i}.md`, text: n.text }))], { secondsAgo: HALF_HOUR_S });
  seedInbox(repo, [{ file: 'README.md', text: 'readme about the inbox, verbatim rules\n' }]);
  ok('pendingNotes counts every note and skips the README', pendingNotes(repo).length === files.length);
  const found = unpromotedRulings(repo, { user: USER });
  ok('only the two real rulings are listed', found.length === 2 && found.every((r) => REAL_RULINGS.some((x) => x.file === r.file)));
  ok('a listed ruling carries id, age and the first line', found[0].id === REAL_RULINGS[0].file.replace(/\.md$/, '') && /^\d+[hd]$/.test(found[0].age) && found[0].title.startsWith('note Song mode rulings'));
  ok('a (type) tag is dropped from the listed title', unpromotedRulings(seedInboxed(), { user: USER })[0].title.startsWith('Song mode'));
  const lines = rulingLines(found, { limit: 1 });
  ok('rulingLines caps the list and says how many more', lines.length === 2 && /\+1 more/.test(lines[1]));

  const turnStart = Date.now() - 60000;
  ok('a note written before the turn is not fresh', freshRulings(found, turnStart).length === 0);
  const tonight = adopted(false);
  seedInbox(tonight, [{ file: `${new Date().toISOString().slice(0, 10)}-${new Date().toISOString().slice(11, 16).replace(':', '')}-note-fresh.md`, text: 'note x (Chris 2026-11-10, verbatim): a ruling just captured\n' }]);
  const fresh = unpromotedRulings(tonight, { user: USER });
  ok('a note written this turn is fresh', freshRulings(fresh, Date.now() - 30000).length === 1);
  ok('a note whose file name stamp is hours old is not fresh even when its mtime is new (a pull)', freshRulings([{ ...fresh[0], capturedMs: Date.now() - 3 * 3600000 }], Date.now() - 30000).length === 0);
  ok('no turn start means nothing is fresh', freshRulings(fresh, 0).length === 0);

  const stop = rulingStop(repo, { turnStartMs: Date.now() - 60000 });
  ok('older rulings warn and do not block', stop.block === '' && /2 maintainer ruling/.test(stop.warn));
  const live = rulingStop(tonight, { turnStartMs: Date.now() - 30000 });
  ok('a ruling captured this turn blocks', /BLOCKED: 1 maintainer ruling/.test(live.block) && live.warn === '');
  ok('the same finding does not block twice', rulingStop(tonight, { turnStartMs: Date.now() - 30000 }).block === '');
  ok('stop_hook_active never blocks', rulingStop(tonight, { turnStartMs: Date.now() - 30000, stopActive: true }).block === '');

  ok('an unknown --from id refuses', (() => { try { resolveInboxNotes(repo, ['2026-11-09-9999']); return false; } catch (e) { return /no inbox note/.test(e.message); } })());
  ok('an ambiguous prefix refuses and names both', (() => { try { resolveInboxNotes(repo, ['2026-11-09-2']); return false; } catch (e) { return /ambiguous/.test(e.message); } })());
  ok('a unique timestamp prefix resolves', resolveInboxNotes(repo, ['2026-11-09-2139'])[0] === REAL_RULINGS[1].file);

  mkdirSync(join(repo, '.ai', 'decisions'), { recursive: true });
  writeFileSync(join(repo, '.ai', 'config.yml'), 'ids:\n  key: "ZR"\n  pad: 3\n');
  const made = recordDecision(repo, DRAFT, { from: ['2026-11-09-2136'] });
  ok('t decide --from moves the note to inbox/triaged and reports it', made.cleared.length === 1 && existsSync(join(repo, '.ai', 'inbox', 'triaged', REAL_RULINGS[0].file)) && !existsSync(join(repo, '.ai', 'inbox', REAL_RULINGS[0].file)));
  ok('the promoted ruling stops being listed', unpromotedRulings(repo, { user: USER }).length === 1);
  const skipped = triageCapture(repo, '2026-11-09-2139-note-song-mode-ruling-in-discussion-chris-2026-1', { skip: true }, () => { throw new Error('skip files nothing'); });
  ok('t triage --skip clears a false match and files no item', skipped.id === '' && unpromotedRulings(repo, { user: USER }).length === 0);
  ok('a bad --from burns no decision id', (() => { try { recordDecision(repo, DRAFT, { from: ['nope'] }); return false; } catch { return !existsSync(join(repo, '.ai', 'decisions', 'ZR-D002-scene-metadata-lives-in-the-scene.md')); } })());
} finally { cleanup(); }
done();
