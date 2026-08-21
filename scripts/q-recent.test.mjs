// q-recent.test.mjs — the KIT-T253 digest: arg parsing, windowing, fallback rollup.
import { strict as assert } from 'node:assert';
import { parseRecentArgs, windowStart, recentFallback, DEFAULT_DAYS } from './q-recent.mjs';

// arg parsing: order-independent days + scope, clamped
assert.deepEqual(parseRecentArgs([]), { days: DEFAULT_DAYS, scope: undefined });
assert.deepEqual(parseRecentArgs(['3d', 'st']), { days: 3, scope: 'ST' });
assert.deepEqual(parseRecentArgs(['ST', '14']), { days: 14, scope: 'ST' });
assert.equal(parseRecentArgs(['999d']).days, 90);

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
const d = recentFallback(items, ['7d', 'ST'], now);
assert.equal(d.window, '2026-08-14 → now (7d, ST)');
assert.deepEqual(d.decisions, [{ id: 'ST-D001', d: '2026-08-20', title: 'a decision' }]);
assert.deepEqual(d.fixed, [{ id: 'ST-T001', d: '2026-08-20', detail: 'abc1234' }]);
assert.deepEqual(d['moved (1)'], [{ id: 'ST-T001', detail: 'doing → review', title: 'a ticket' }]);
assert.deepEqual(d['created (0)'], []); // ST-T001's created is out of window; GB filtered

// no scope filter: GB's created appears
const all = recentFallback(items, [], now);
assert.equal(all['created (1)'].length, 1);

console.log('q-recent.test: ok');
