// Fixtures for the inbox-ruling tests (KIT-T938): the real captures that rested un-promoted in groovegrid's inbox,
// and notes that must not read as rulings.
//   REAL_RULINGS  -> [{ file, text }]   capture bodies, abridged
//   NOT_RULINGS   -> [{ name, text }]
//   seedInbox(root, notes, { secondsAgo }) -> writes each note into root/.ai/inbox/ and returns the file names

import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const REAL_RULINGS = [
  {
    file: '2026-11-09-2136-note-song-mode-rulings-in-discussion-chris-2026-.md',
    text: "note Song mode rulings in discussion (Chris 2026-11-09, verbatim): 'A scene owns its values and it might be nice to keep the metadata on hand even when it gets copied into the scene or arrangement mode.' On the Song timeline rows: 'If you mean timeline rows that mirror the automation widgets, yes, those are stored per scene, but can be edited multiple scenes at a time because the scene data is all in one view, just like the note data in scene mode.' Consequence noted by Claude, not ruled: curve rows are stored on the Song context per bar today. Follows the earlier big-picture note of the same day; related GG-T158.\n",
  },
  {
    file: '2026-11-09-2139-note-song-mode-ruling-in-discussion-chris-2026-1.md',
    text: "note Song mode ruling in discussion (Chris 2026-11-09, verbatim, said right after 'Instrument roles should remain project level, but they'll need their own modal'): 'That modal button trigger exists only in song mode though.' Claude's reading, unconfirmed: the Roles modal is project-level data but its button shows only in Song mode. Related GG-T158.\n",
  },
];

export const NOT_RULINGS = [
  { name: 'a plain bug capture', text: '(bug) login redirect loops after SSO\n' },
  { name: 'a bug capture quoting error text', text: '(bug) the console prints "could not open the project file for writing" on save\n' },
  { name: 'a kit gap with no speaker', text: '(feature) q: code has no --file flag\n' },
  { name: 'an untyped idea', text: 'form double-submits on slow network\n' },
];

const SECONDS_TO_MS = 1000;

export function seedInbox(root, notes, { secondsAgo = 0 } = {}) {
  const dir = join(root, '.ai', 'inbox');
  mkdirSync(join(dir, 'triaged'), { recursive: true });
  const at = (Date.now() - secondsAgo * SECONDS_TO_MS) / SECONDS_TO_MS;
  return notes.map(({ file, text }) => {
    writeFileSync(join(dir, file), text);
    utimesSync(join(dir, file), at, at);
    return file;
  });
}
