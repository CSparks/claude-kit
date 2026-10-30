// stale-envelope.mjs — remember which envelopes came back stale (KIT-T503). A worker that resubmits the identical
// envelope on the same base gets the same stale result again after a queue slot, so submit refuses it up front.
//
//   envelopeHash(text) -> sha256 of the envelope bytes the worker sent
//   recordStaleEnvelope(cfg, result, envelope)   called with every stale result the broker writes
//   priorStale(cfg, envelope, base) -> the entry { envelope, base, id, reason } of an earlier stale on this base, or null

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';

const LEDGER = 'stale-envelopes.json';
const KEEP = 200;

export const envelopeHash = (text) => createHash('sha256').update(String(text)).digest('hex');

const ledgerPath = (cfg) => join(brokerPaths(cfg).home, LEDGER);

function readLedger(cfg) {
  try { return JSON.parse(readFileSync(ledgerPath(cfg), 'utf8')); } catch { return []; }
}

export function recordStaleEnvelope(cfg, result, envelope) {
  if (!envelope || !result.base) return;
  const reason = (result.stale || []).map((s) => `${s.path}: ${s.reason}`).join('; ') || result.message || result.phase;
  const kept = readLedger(cfg).filter((e) => !(e.envelope === envelope && e.base === result.base));
  kept.push({ envelope, base: result.base, id: result.id, reason });
  writeFileSync(ledgerPath(cfg), JSON.stringify(kept.slice(-KEEP), null, 2));
}

export const priorStale = (cfg, envelope, base) => readLedger(cfg).find((e) => e.envelope === envelope && e.base === base) || null;
