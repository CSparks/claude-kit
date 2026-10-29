// watch-events.mjs — what the broker finished since a moment, across every lane of a checkout
// (KIT-T697): job results and suite runs, read from the result and suite files. The reader behind
// watch.mjs, so an orchestrator waits on "the next landing" or "the suite" without tailing a daemon log.
//
// `eventsSince(rootCfg, sinceMs)` → [{ kind: 'job'|'suite', lane, id, status, at, ok, text }] oldest first.
// `matches(event, want)` → does the event satisfy `want` ('landing' | 'suite' | 'any').

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, laneConfigs } from './config.mjs';
import { isCurrentResult } from './current.mjs';
import { STATUS } from './result.mjs';

const SUITE_STATE = 'state.json';
const SUITE_SHA_CHARS = 7;
const GOOD_JOB = new Set([STATUS.PASSED, STATUS.LANDED]);
const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const jsonFiles = (dir) => { try { return readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; } };
const newer = (file, sinceMs) => { try { return statSync(file).mtimeMs > sinceMs; } catch { return false; } };

function jobEvents(cfg, sinceMs) {
  const dir = brokerPaths(cfg).results;
  const out = [];
  for (const name of jsonFiles(dir)) {
    if (!newer(join(dir, name), sinceMs)) continue;
    const r = readJson(join(dir, name));
    const at = Date.parse(r?.finishedAt);
    if (!r || !(at > sinceMs) || r.status === STATUS.DIRTY || !isCurrentResult(cfg, r)) continue;
    const landed = r.landed ? ` ${r.landed.sha}` : '';
    out.push({ kind: 'job', lane: cfg.lane || '', id: r.id, status: r.status, at, ok: GOOD_JOB.has(r.status), text: `${r.id} [${r.repo || ''}] → ${r.status}${landed}` });
  }
  return out;
}

function suiteEvents(cfg, sinceMs) {
  const dir = join(brokerPaths(cfg).home, 'suite');
  const out = [];
  for (const name of jsonFiles(dir)) {
    if (name === SUITE_STATE || !newer(join(dir, name), sinceMs)) continue;
    const r = readJson(join(dir, name));
    if (!r?.status || r.cancelled) continue;
    const sha = name.slice(0, -'.json'.length).slice(0, SUITE_SHA_CHARS);
    out.push({ kind: 'suite', lane: cfg.lane || '', id: sha, status: r.status, at: statSync(join(dir, name)).mtimeMs, ok: r.status === STATUS.PASSED, text: `suite ${sha} → ${r.status}${r.filed ? ' (regression filed)' : ''}` });
  }
  return out;
}

export function eventsSince(rootCfg, sinceMs) {
  const events = laneConfigs(rootCfg).flatMap((cfg) => existsSync(brokerPaths(cfg).home) ? [...jobEvents(cfg, sinceMs), ...suiteEvents(cfg, sinceMs)] : []);
  return events.sort((a, b) => a.at - b.at);
}

export function matches(event, want) {
  if (want === 'landing') return event.kind === 'job' && event.status === STATUS.LANDED;
  if (want === 'suite') return event.kind === 'suite';
  return true;
}
