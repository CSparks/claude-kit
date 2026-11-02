// dispatch-escalation (KIT-T432, KIT-D090): a job dearer than the ticket type's default needs [escalate: reason]; the job
// follows the tickets the brief works, not one it merely cites (KIT-T547).
// Run: node hooks/dispatch-escalation.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, finish, ignoreFile, makeRepo, run, transcript } from './dispatch-guard-harness.mjs';

const ticketFile = (dir, id, type) => {
  mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(dir, '.ai', 'tickets', `${id}-x.md`), `---\nid: ${id}\ntitle: x\ntype: ${type}\n---\nbody\n`);
};

{
  const repo = makeRepo();
  const opus = transcript(repo, 'opus-session', 'claude-opus-4-8');
  ticketFile(repo, 'KIT-T901', 'bug');
  ticketFile(repo, 'KIT-T902', 'regression');
  ticketFile(repo, 'KIT-T903', 'epic');
  const call = (input) => run(repo, { jobless: true, subagent_type: 'general-purpose', ...input }, opus);
  const esc = call({ model: 'opus', prompt: 'fix KIT-T901 [job: build]' });
  expect('a bug ticket dispatched as build (opus) blocks', esc.code, 2);
  expect('the escalation block names the cheaper job', /dispatch \[job: fix\] \(sonnet\)/.test(esc.err) ? 1 : 0, 1);
  expect('the escalation block names the escape token', /\[escalate: <reason>\]/.test(esc.err) ? 1 : 0, 1);
  expect('the escalation block carries its check footer', /dispatch-escalation/.test(esc.err) ? 1 : 0, 1);
  expect('build on sonnet (an exhaustive brief) passes on a bug ticket', call({ model: 'sonnet', prompt: 'apply KIT-T901 [job: build]' }).code, 0);
  expect('an opus model on a build job needs [escalate] on a bug ticket', call({ model: 'opus', prompt: 'apply KIT-T901 [job: build]' }).code, 2);
  expect('the plan job (fable) passes on a bug ticket with no escalate', call({ model: 'fable', prompt: 'plan the KIT-T901 terrain integration [job: plan]' }).code, 0);
  expect('the plan job on opus (its default family, KIT-D098) passes on a bug ticket with no escalate', call({ model: 'opus', prompt: 'plan the KIT-T901 terrain integration [job: plan]' }).code, 0);
  expect('the plan job on sonnet is outside its row', call({ model: 'sonnet', prompt: 'plan the KIT-T901 terrain integration [job: plan]' }).code, 2);
  expect('greenfield on opus passes on a bug ticket with no escalate or model-override (DE-D057)', call({ model: 'opus', prompt: 'build the new weather system KIT-T901 [job: greenfield]' }).code, 0);
  expect('greenfield with no model passes', call({ prompt: 'build the new weather system KIT-T901 [job: greenfield]' }).code, 0);
  expect('greenfield on sonnet is outside its row', call({ model: 'sonnet', prompt: 'build the new weather system KIT-T901 [job: greenfield]' }).code, 2);
  expect('a follow-up fix on opus still needs the escalation tags', call({ model: 'opus', prompt: 'follow-up KIT-T901 [job: fix]' }).code, 2);
  expect('a follow-up fix on sonnet passes', call({ model: 'sonnet', prompt: 'follow-up KIT-T901 [job: fix]' }).code, 0);
  expect('read-only planning with no ticket passes on the plan job', call({ subagent_type: 'Explore', model: 'fable', prompt: 'plan the mine entrances [job: plan]' }).code, 0);
  expect('a fable model on a fix job still needs [escalate]', call({ model: 'fable', prompt: 'KIT-T901 [job: fix] [model-override: x]' }).code, 2);
  expect('a bug ticket as fix passes', call({ model: 'sonnet', prompt: 'fix KIT-T901 [job: fix]' }).code, 0);
  expect('[escalate: reason] lets the opus build through', call({ model: 'opus', prompt: 'fix KIT-T901 [job: build] [escalate: novel geometry]' }).code, 0);
  expect('an empty [escalate:] does not count', call({ model: 'opus', prompt: 'fix KIT-T901 [job: build] [escalate: ]' }).code, 2);
  expect('forensic on a bug ticket blocks', call({ model: 'opus', prompt: 'KIT-T901 [job: forensic]' }).code, 2);
  expect('forensic on a regression ticket passes', call({ model: 'opus', prompt: 'KIT-T902 [job: forensic]' }).code, 0);
  expect('forensic passes when the brief also names a regression', call({ model: 'opus', prompt: 'KIT-T901 KIT-T902 [job: forensic]' }).code, 0);
  expect('forensic on an epic (opus default) still needs a regression', call({ model: 'opus', prompt: 'KIT-T903 [job: forensic]' }).code, 2);
  expect('design on an epic ticket passes', call({ model: 'opus', prompt: 'KIT-T903 [job: design]' }).code, 0);
  expect('an unknown ticket id imposes nothing', call({ model: 'opus', prompt: 'KIT-T999 [job: build]' }).code, 0);
  expect('a writer with no ticket is not held', call({ model: 'opus', prompt: 'x [job: build]' }).code, 0);
  const ro = call({ subagent_type: 'Explore', model: 'opus', prompt: 'trace the mine site [job: forensic]' });
  expect('read-only diagnosis with no ticket defaults to research and blocks forensic', ro.code, 2);
  expect('the read-only block names research (sonnet)', /dispatch \[job: research\] \(sonnet\)/.test(ro.err) ? 1 : 0, 1);
  expect('read-only research with no ticket passes', call({ subagent_type: 'Explore', model: 'sonnet', prompt: 'trace [job: research]' }).code, 0);
  expect('read-only forensic with [escalate] passes', call({ subagent_type: 'Explore', model: 'opus', prompt: 'trace [job: forensic] [escalate: failed first pass]' }).code, 0);
  const ignored = ignoreFile(makeRepo(), 'dispatch-escalation');
  expect('the ignore file lifts the escalation gate', run(ignored, { jobless: true, subagent_type: 'Explore', model: 'opus', prompt: 'x [job: forensic]' }, opus).code, 0);
}

// The job follows the tickets the brief works, not one it cites (KIT-T547).
{
  const repo = makeRepo();
  const opus = transcript(repo, 'opus-session', 'claude-opus-4-8');
  ticketFile(repo, 'ST-T904', 'tech-debt');
  const call = (input) => run(repo, { jobless: true, subagent_type: 'general-purpose', ...input }, opus);
  const brief = 'fix RG-T213 and RG-T215, both bugs; the vetting ticket is ST-T904 [job: fix]';
  expect('control: a fix job on a brief that names only a tech-debt ticket blocks (fix outranks chore)', call({ model: 'sonnet', prompt: 'fix the vetting ticket ST-T904 [job: fix]' }).code, 2);
  expect('bug ids in no store, tech-debt ST-T904 cited: the untyped ids hold the job at the catch-all, so fix passes', call({ model: 'sonnet', prompt: brief }).code, 0);
  writeFileSync(join(repo, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  ticketFile(join(repo, 'rapid-game'), 'RG-T213', 'bug');
  ticketFile(join(repo, 'rapid-game'), 'RG-T215', 'bug');
  expect('bug tickets in the submodule store, tech-debt ST-T904 cited: fix passes', call({ model: 'sonnet', prompt: brief }).code, 0);
  expect('control: an opus build on that brief still blocks', call({ model: 'opus', prompt: 'fix RG-T213 and RG-T215, context ST-T904 [job: build]' }).code, 2);
}

finish();
