#!/usr/bin/env node
// KIT-T844: the maintainer's comments on a decision's subject reach the dispatch brief.
// Run: node scripts/maintainer-said.test.mjs

import assert from 'node:assert/strict';
import { isObjection, maintainerSaid } from './maintainer-said.mjs';
import { renderGoverning } from './governing-brief.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const decision = { id: 'DE-D063', title: 'MX courses use the stadium layout generator at the stadium 8x6 grid', history: [{ ts: '2026-10-29', event: 'created' }] };
const comment = (ref, author, ts, text) => ({ ref, author, ts, text });
const rejection = comment('DE-T227#1', 'chris', '2026-10-29 16:38', "3 tracks now, two triangles and a rectangle. I DIDN'T SAY THE MX TRACKS NEEDED A DIFFERENT LAYOUT; the stadium generator on its grid was the plan");

await test('a maintainer comment on the decision subject, dated after it, is surfaced and flagged as an objection', () => {
  const said = maintainerSaid(decision, [rejection], 'chris');
  assert.deepEqual(said.map((s) => s.ref), ['DE-T227#1']);
  assert.ok(said[0].objection);
});

await test('controls: another author, an earlier comment, and an unrelated subject are not surfaced', () => {
  const agent = comment('DE-T227#2', 'bike-agent', '2026-10-29 17:00', rejection.text);
  const earlier = comment('DE-T100#1', 'chris', '2026-10-01 09:00', rejection.text);
  const unrelated = comment('DE-T300#1', 'chris', '2026-10-30 09:00', 'the engine sound is wrong, never ships like this');
  assert.deepEqual(maintainerSaid(decision, [agent, earlier, unrelated], 'chris'), []);
});

await test('naming the decision id is enough, and ranks above a topic match', () => {
  const byId = comment('DE-T9#1', 'chris', '2026-10-30 09:00', 'DE-D063 stands');
  assert.deepEqual(maintainerSaid(decision, [rejection, byId], 'chris').map((s) => s.ref), ['DE-T9#1', 'DE-T227#1']);
});

await test('isObjection reads rejections and shouting, not plain statements', () => {
  assert.ok(isObjection("I didn't say that"));
  assert.ok(isObjection('THIS IS NOT WHAT I ASKED'));
  assert.ok(!isObjection('the grid is fine as it stands'));
});

await test('the brief prints each maintainer line under its decision and the read-before-dispatch warning', () => {
  const out = renderGoverning([{ id: 'DE-D063', store: 'decisions', via: 'trail', summary: 's', parked: false, said: maintainerSaid(decision, [rejection], 'chris') }]).join('\n');
  assert.match(out, /!! OBJECTION\? MAINTAINER SAID after this decision \(DE-T227#1, 2026-10-29 16:38\)/);
  assert.match(out, /take any ruling that departs from it to him/);
  assert.ok(!/MAINTAINER SAID/.test(renderGoverning([{ id: 'D', store: 'decisions', via: 'trail', summary: 's', parked: false, said: [] }]).join('\n')), 'control: no comment, no line');
});

console.log(`\nmaintainer-said: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
