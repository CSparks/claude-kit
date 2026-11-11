// build-long-hold.mjs — flag a build that holds cores past the KIT-D104 5-minute ceiling (KIT-T1031). One kit bug per
// hold: a marker file `flagged-<hold>` beside the holds makes every later waiter skip it, and the kit-bug shape is
// stable (the hold's root and command), so a repeat of the same job is a "seen again" comment, never a new ticket.
//
//   flagLongHolds(holds, { dir?, file?, now? }) -> [hold] newly flagged; `file` is the kit-bug filer (tests inject one)
//   Markers of holds that ended are removed on each call.

import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isLongHold } from './build-grant.mjs';
import { slotDir } from './build-slot-store.mjs';

const MARKER_PREFIX = 'flagged-';
const MS_PER_MINUTE = 60000;

async function fileKitBug(bug) {
  const { fileKitBug: file } = await import('../kit-bug.mjs');
  return file(bug);
}

function claim(path) {
  try { writeFileSync(path, '', { flag: 'wx' }); return true; } catch { return false; }
}

export function bugFor(hold, now) {
  const minutes = Math.round((now - Date.parse(hold.ts)) / MS_PER_MINUTE);
  const job = String(hold.label).trim();
  return {
    shape: `build-budget:over-ceiling:${hold.cwd}:${job}`,
    title: `build-budget: a build held ${hold.jobs} cores past the 5-minute ceiling (KIT-D104): ${job}`,
    detail: `Job ${job} (pid ${hold.pid}) in root ${hold.cwd} held ${hold.jobs} cores for ${minutes} min and was still running; other builds queue behind it. Split, scope or speed it up (KIT-T1031).`,
    project: hold.cwd,
  };
}

export async function flagLongHolds(holds, { dir = slotDir(), file = fileKitBug, now = Date.now() } = {}) {
  const live = new Set(holds.map((h) => `${MARKER_PREFIX}${h.name}`));
  try {
    for (const name of readdirSync(dir).filter((n) => n.startsWith(MARKER_PREFIX) && !live.has(n))) rmSync(join(dir, name), { force: true });
  } catch { /* a missing directory has no markers */ }
  const flagged = [];
  for (const hold of holds.filter((h) => isLongHold(h, now))) {
    if (!claim(join(dir, `${MARKER_PREFIX}${hold.name}`))) continue;
    await file(bugFor(hold, now));
    flagged.push(hold);
  }
  return flagged;
}
