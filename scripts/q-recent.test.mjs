// q-recent.test.mjs — the KIT-T253 digest: arg parsing, windowing, fallback rollup.
// Scope defaulting (KIT-T255) needs a root: an ADOPTED fixture defaults to its key, a bare
// tmp dir (no .ai/config.yml anywhere above it) keeps the every-scope default.
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRecentArgs, windowStart, recentFallback, DEFAULT_DAYS } from './q-recent.mjs';

const OUTSIDE = mkdtempSync(join(tmpdir(), 'kit-recent-'));   // not an adopted repo
const ADOPTED = join(OUTSIDE, 'proj-st');
mkdirSync(join(ADOPTED, '.ai'), { recursive: true });
writeFileSync(join(ADOPTED, '.ai', 'config.yml'), 'ids:\n  key: "ST"\n  pad: 3\n');

// arg parsing: order-independent days + scope, clamped
assert.deepEqual(parseRecentArgs([], OUTSIDE), { days: DEFAULT_DAYS, scope: '' });
assert.deepEqual(parseRecentArgs(['3d', 'st'], OUTSIDE), { days: 3, scope: 'ST' });
assert.deepEqual(parseRecentArgs(['ST', '14'], OUTSIDE), { days: 14, scope: 'ST' });
assert.equal(parseRecentArgs(['999d'], OUTSIDE).days, 90);

// KIT-T255 scope defaulting: no token inside an adopted repo means THAT project; `all`
// (either case) widens; an explicit key still wins; outside a repo the default stays wide.
assert.deepEqual(parseRecentArgs([], ADOPTED), { days: DEFAULT_DAYS, scope: 'ST' });
assert.deepEqual(parseRecentArgs(['3d'], ADOPTED), { days: 3, scope: 'ST' });
assert.equal(parseRecentArgs(['all'], ADOPTED).scope, '');
assert.equal(parseRecentArgs(['ALL'], ADOPTED).scope, '');
assert.equal(parseRecentArgs(['gb'], ADOPTED).scope, 'GB');

// windowing: N days back, date-only
const now = new Date('2026-08-21T12:00:00Z');
assert.equal(windowStart(7, now), '2026-08-14');

// fallback rollup: decisions vs created split, fixed carried, out-of-window dropped,
// latest status move wins, scope filter applies
const items = [
  { id: 'ST-D001', scope: 'ST', store: 'decisions', title: 'a decision',
    history: [{ ts: '2026-08-20T10:00', event: 'created', detail: '' }] },
  { id: 'ST-T001', scope: 'ST', store: 'tickets', type: 'bug', title: 'a ticket', history: [
    { ts: '2026-08-01T10:00', event: 'created', detail: 'too old' },
    { ts: '2026-08-19T10:00', event: 'status', detail: 'todo → doing' },
    { ts: '2026-08-20T10:00', event: 'status', detail: 'doing → review' },
    { ts: '2026-08-20T11:00', event: 'fixed', detail: 'abc1234' }] },
  { id: 'GB-T009', scope: 'GB', store: 'tickets', type: 'bug', title: 'other scope',
    history: [{ ts: '2026-08-20T10:00', event: 'created', detail: '' }] },
];
const d = recentFallback(items, ['7d', 'ST'], OUTSIDE, now);
assert.equal(d.window, '2026-08-14 → now (7d, ST)');
assert.deepEqual(d.decisions, [{ id: 'ST-D001', d: '2026-08-20', title: 'a decision' }]);
assert.deepEqual(d.fixed, [{ id: 'ST-T001', d: '2026-08-20', detail: 'abc1234' }]);
assert.deepEqual(d['moved (1)'], [{ id: 'ST-T001', detail: 'doing → review', title: 'a ticket' }]);
assert.deepEqual(d['created (0)'], []); // ST-T001's created is out of window; GB filtered

// no scope token, run OUTSIDE an adopted repo: every scope — GB's created appears
const all = recentFallback(items, [], OUTSIDE, now);
assert.equal(all['created (1)'].length, 1);

// the same call INSIDE the adopted ST repo: the cwd project is the default, GB drops out
const st = recentFallback(items, [], ADOPTED, now);
assert.equal(st.window, '2026-08-14 → now (7d, ST)');
assert.equal(st['created (0)'].length, 0);
assert.deepEqual(st.decisions, [{ id: 'ST-D001', d: '2026-08-20', title: 'a decision' }]);

// …and `all` from inside that repo widens back to every scope
const wide = recentFallback(items, ['all'], ADOPTED, now);
assert.equal(wide['created (1)'].length, 1);

console.log('q-recent.test: ok');
