// red-run.mjs — the red-run cap (KIT-T686): after RED_LIMIT consecutive failed jobs on one ticket, a submit
// for it is refused until the ticket's Notes changed since the last red, or `--diagnosed "<cause>"` is given.
// State is <target>/broker/redruns.json, shared by every lane. A job or ticket with no file is never refused.
//   recordRun(cfg, result)                -> counts a final result (writeResult calls it)
//   redRunRefusal(cfg, ticket, diagnosed) -> a refusal text, or null when the submit may go
//   ticketNotes(root, ticket)             -> the ticket's `## Notes` text, or null when its file is not found

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const RED_LIMIT = 2;
const MIN_DIAGNOSIS_CHARS = 20;
const KEEP_IDS = 8;
const MAX_TICKETS = 200;

const stateFile = (cfg) => join(cfg.targetDir, 'broker', 'redruns.json');
const readState = (cfg) => { try { return JSON.parse(readFileSync(stateFile(cfg), 'utf8')); } catch { return {}; } };

function writeState(cfg, state) {
  const keys = Object.keys(state);
  if (keys.length > MAX_TICKETS) for (const k of keys.slice(0, keys.length - MAX_TICKETS)) delete state[k];
  mkdirSync(join(cfg.targetDir, 'broker'), { recursive: true });
  writeFileSync(stateFile(cfg), JSON.stringify(state, null, 2));
}

export function ticketNotes(root, ticket) {
  for (const dir of [join(root, '.ai', 'tickets'), join(root, '.ai', 'tickets', 'archive')]) {
    if (!existsSync(dir)) continue;
    const file = readdirSync(dir).find((f) => f.startsWith(`${ticket}-`) && f.endsWith('.md'));
    if (!file) continue;
    const text = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    const at = text.indexOf('\n## Notes');
    if (at < 0) return '';
    const rest = text.slice(at + 1);
    const next = rest.indexOf('\n## ', 1);
    return next < 0 ? rest : rest.slice(0, next);
  }
  return null;
}

const hashOf = (text) => createHash('sha1').update(String(text)).digest('hex');
const notesHash = (cfg, ticket) => { const n = ticketNotes(cfg.root, ticket); return n === null ? null : hashOf(n); };

export function recordRun(cfg, result) {
  try {
    const ticket = result && result.ticket;
    if (!ticket || !['failed', 'passed', 'landed'].includes(result.status)) return;
    const state = readState(cfg);
    if (result.status !== 'failed') {
      if (!(ticket in state)) return;
      delete state[ticket];
    } else {
      const prev = state[ticket] || { reds: 0, ids: [] };
      if (prev.ids.includes(result.id)) return;
      delete state[ticket];
      state[ticket] = { reds: prev.reds + 1, ids: [...prev.ids, result.id].slice(-KEEP_IDS), notesHash: notesHash(cfg, ticket) };
    }
    writeState(cfg, state);
  } catch { /* the cap is a guard rail, never a reason to lose a result */ }
}

export function redRunRefusal(cfg, ticket, diagnosed) {
  if (!ticket) return null;
  const entry = readState(cfg)[ticket];
  if (!entry || entry.reds < RED_LIMIT || entry.notesHash === null) return null;
  const now = notesHash(cfg, ticket);
  if (now === null || now !== entry.notesHash) return null;
  if (typeof diagnosed === 'string' && diagnosed.trim().length >= MIN_DIAGNOSIS_CHARS) {
    const state = readState(cfg);
    state[ticket] = { ...entry, notesHash: `diagnosed:${hashOf(diagnosed)}` };
    writeState(cfg, state);
    return null;
  }
  return `${entry.reds} jobs in a row on ${ticket} are red (${entry.ids.slice(-RED_LIMIT).join(', ')}) and its Notes have not changed since: write what the failure was and what you change (t notes ${ticket} "<diagnosis>"), or pass --diagnosed "<the cause, ${MIN_DIAGNOSIS_CHARS}+ chars>". The queue is not a compiler.`;
}
