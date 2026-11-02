// brief-grounded (KIT-T703): a brief citing a feature or request ticket carries the maintainer's words and, for a variant,
// the mechanism it reuses. Bug briefs, briefs citing no ticket and read-only agents pass.
// Run: node hooks/dispatch-brief.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, finish, ignoreFile, makeRepo, run, transcript } from './dispatch-guard-harness.mjs';

const repo = makeRepo();
const opus = transcript(repo, 'opus-session', 'claude-opus-4-8');
const ticket = (id, type, title) => {
  mkdirSync(join(repo, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(repo, '.ai', 'tickets', `${id}-x.md`), `---\nid: ${id}\ntitle: ${title}\ntype: ${type}\nstatus: todo\n---\nbody\n`);
};
ticket('KIT-T910', 'feature', 'MX track class with higher hills and jumps');
ticket('KIT-T911', 'feature', 'Add a tooltip to the garage button');
ticket('KIT-T912', 'bug', 'MX track class draws no jumps');
const call = (prompt, extra = {}) => run(repo, { subagent_type: 'general-purpose', model: 'sonnet', prompt, ...extra }, opus);
const words = '[maintainer-words: "MX tracks get higher hills and jumps"]';
const blocked = call('build KIT-T910');
expect('a feature brief with no quoted maintainer words is blocked', blocked.code, 2);
expect('the block names the check and the DE-T195 example', /brief-grounded/.test(blocked.err) && /stadium layout generator/.test(blocked.err) ? 1 : 0, 1);
expect('a variant feature with words but no reuses token is blocked', call(`build KIT-T910 ${words}`).code, 2);
expect('a feature brief with a quote and a reuses token passes', call(`build KIT-T910 ${words} [reuses: stadium layout generator]`).code, 0);
expect('a non-variant feature needs only the quote', call(`build KIT-T911 ${words}`).code, 0);
expect('negative control: a bug brief passes with no quote', call('fix KIT-T912').code, 0);
expect('negative control: an empty maintainer-words token does not count', call('build KIT-T911 [maintainer-words: ]').code, 2);
expect('negative control: a brief citing no ticket passes', call('tidy the readme').code, 0);
expect('negative control: a read-only agent is not asked', call('study KIT-T910', { subagent_type: 'Explore' }).code, 0);
expect('the ignore file lifts brief-grounded', run(ignoreFile(repo, 'brief-grounded'), { subagent_type: 'general-purpose', model: 'sonnet', prompt: 'build KIT-T910' }, opus).code, 0);

finish();
