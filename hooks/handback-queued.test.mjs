// handback-queued: a held brief applies to an item only when it was queued after that item's agent retired, and the
// newest such row wins; a row from an earlier handoff was consumed by the dispatch that followed it (KIT-T855).
// Run: node hooks/handback-queued.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyQueued, DISPATCH_QUEUED, QUEUED } from './lib/handback-queued.mjs';
import { QUEUE_REL } from './lib/queued-dispatch.mjs';
import { reporter } from './test-harness.mjs';

const { ok, done } = reporter('handback-queued');
const TICKET = 'DE-T295';
const MIN_MS = 60000;
const BASE_MS = Date.UTC(2026, 10, 3, 12, 0, 0);
const at = (min) => new Date(BASE_MS + min * MIN_MS).toISOString();
const root = mkdtempSync(join(tmpdir(), 'hbq-'));

try {
  const queued = (...rows) => {
    mkdirSync(join(root, '.ai'), { recursive: true });
    writeFileSync(join(root, QUEUE_REL), rows.map((r) => `${JSON.stringify({ tickets: [TICKET], scope: 'w', brief: `brief ${r.id}`, ...r })}\n`).join(''));
  };
  const item = (retired) => ({ kind: 'successor', step: 'successor', key: `successor:a:${TICKET}`, ticket: TICKET, retired, text: 'orig' });
  const ended = [{ id: 'b1', status: 'done' }, { id: 'b2', status: 'done' }];
  const live = [{ id: 'b1', status: 'done' }, { id: 'b2', status: 'in-flight' }];

  queued({ id: 'q-b1', ts: at(10), blockedBy: 'b1' });
  const fresh = applyQueued(root, ended, [item(at(5))])[0];
  ok('a row queued after the retirement, blocker ended: dispatch-queued with the held brief', fresh.step === DISPATCH_QUEUED && fresh.text.includes('brief q-b1'));

  const stale = applyQueued(root, ended, [item(at(30))])[0];
  ok('negative: a row queued before the retirement is consumed, the item keeps its own step', stale.step === 'successor' && stale.text === 'orig');

  queued({ id: 'q-b1', ts: at(10), blockedBy: 'b1' }, { id: 'q-b2', ts: at(40), blockedBy: 'b2' });
  const newest = applyQueued(root, live, [item(at(5))])[0];
  ok('the newest live row wins: queued behind the in-flight blocker, not the old ended one', newest.step === QUEUED && newest.text.includes('b2'));

  const mixed = applyQueued(root, live, [item(at(20))])[0];
  ok('rows older than the retirement are skipped while a newer one remains', mixed.step === QUEUED);
  const none = applyQueued(root, live, [item(at(50))])[0];
  ok('control: every row older than the retirement leaves the item untouched', none.step === 'successor');
} finally {
  rmSync(root, { recursive: true, force: true });
  done();
}
