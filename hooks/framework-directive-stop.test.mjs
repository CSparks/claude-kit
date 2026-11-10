// framework-directive-stop (KIT-T943): in the framework's own store a maintainer directive resting in the inbox for
// CONFIRMATION_DAYS or more blocks every Stop until it is triaged. The real rapid-game framework-policy note is the fixture.
// A young directive, a note that is no directive, the same note in a game store, a machine with no framework project,
// a triaged note and stop_hook_active all pass. Run: node hooks/framework-directive-stop.test.mjs

import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRIAGE_LINE } from './lib/block-triage.mjs';
import { CONFIRMATION_DAYS } from '../scripts/q-inbox.mjs';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { NOT_RULINGS, seedInbox } from './inbox-rulings-fixtures.mjs';

const { ok, done } = reporter('framework-directive-stop');
const DAY_MS = 86400000;
const TURN_AGO_MS = 20000;
const OLD_EXTRA_DAYS = 10;
const POLICY = {
  file: '2026-10-28-2252-framework-policy-chris-2026-10-28-rapid-game-pus.md',
  text: "(decision) Framework policy (Chris 2026-10-28): rapid-game pushes toward batching, reuse and caching, as Stiletto's perf work established. Make it a CHOICES/CRATES rule and a checklist item for framework and game rendering work. Chris: 'The policy in Stiletto, which should be the policy in the framework should be to push toward batching and reusing.' / 'And caching.'\n",
};

const stampDaysAgo = (days) => {
  const iso = new Date(Date.now() - days * DAY_MS).toISOString();
  return `${iso.slice(0, 10)}-${iso.slice(11, 16).replace(':', '')}`;
};
const note = (days, slug, text) => ({ file: `${stampDaysAgo(days)}-${slug}.md`, text });

function turnTranscript() {
  const file = join(tmpDir('fds-tx-'), 'session.jsonl');
  const ts = new Date(Date.now() - TURN_AGO_MS).toISOString();
  writeFileSync(file, `${JSON.stringify({ type: 'user', timestamp: ts, message: { role: 'user', content: 'what is next?' } })}\n`);
  return file;
}

try {
  const framework = adopted(false);
  const game = adopted(false);
  const registry = (projects) => { const file = join(tmpDir('fds-reg-'), 'registry.json'); writeFileSync(file, JSON.stringify({ projects })); return file; };
  const withFramework = registry({ 'rapid-game': framework });
  const stop = (repo, extra = {}, reg = withFramework) =>
    hook('flush.mjs', { hook_event_name: 'Stop', session_id: 's1', transcript_path: turnTranscript(), ...extra }, repo, { KIT_USER: 'chris', CLAUDE_KIT_UNBOUNDED_AI: '', CLAUDE_KIT_REGISTRY: reg });

  seedInbox(framework, [POLICY]);
  const blocked = stop(framework);
  ok('an old directive in the framework inbox blocks the Stop and names the note, the age rule and the triage routes',
    blocked.code === 2 && /BLOCKED: 1 maintainer directive/.test(blocked.out) && blocked.out.includes(POLICY.file.replace(/\.md$/, ''))
    && new RegExp(`${CONFIRMATION_DAYS}\\+ days`).test(blocked.out) && /t decide --file <draft\.md> --from <inbox id>/.test(blocked.out) && /t triage <id> --skip/.test(blocked.out));
  ok('the block ends with the BLOCK TRIAGE line', blocked.out.includes(TRIAGE_LINE));
  ok('it blocks every Stop, not once', stop(framework).code === 2 && stop(framework).code === 2);
  ok('negative control: stop_hook_active never blocks', stop(framework, { stop_hook_active: true }).code === 0);
  seedInbox(game, [POLICY]);
  const gameRun = stop(game);
  ok('negative control: the same note in a game store only warns', gameRun.code === 0 && /WARNING: 1 maintainer ruling/.test(gameRun.out));
  ok('negative control: a machine with no framework project blocks nothing', stop(framework, {}, registry({})).code === 0);

  renameSync(join(framework, '.ai', 'inbox', POLICY.file), join(framework, '.ai', 'inbox', 'triaged', POLICY.file));
  ok('negative control: once triaged the Stop is silent', stop(framework).out === '');

  seedInbox(framework, [note(CONFIRMATION_DAYS - 1, 'framework-policy-young', POLICY.text)]);
  const youngRun = stop(framework);
  ok('negative control: a directive younger than the limit only warns', youngRun.code === 0 && /WARNING: 1 maintainer ruling/.test(youngRun.out));

  const plain = adopted(false);
  const plainStop = () => stop(plain, {}, registry({ 'rapid-game': plain }));
  seedInbox(plain, [note(CONFIRMATION_DAYS + OLD_EXTRA_DAYS, 'bug-login', NOT_RULINGS[0].text)]);
  ok('negative control: an old note that is no directive does not block', plainStop().code === 0);
  seedInbox(plain, [note(CONFIRMATION_DAYS + OLD_EXTRA_DAYS, 'directive-old', POLICY.text)]);
  ok('mutation check: the same store blocks once an old directive joins the plain note', plainStop().code === 2);
} finally { cleanup(); }
done();
