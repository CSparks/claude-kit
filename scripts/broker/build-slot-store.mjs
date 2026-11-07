// build-slot-store.mjs — the on-disk state of the machine build budget (KIT-D135): one directory under
// the user's `.claude` shared by every checkout, broker and build runner.
//
//   slotDir()                -> directory (CLAUDE_KIT_BUILD_SLOT_DIR moves it, tests)
//   queueDir(dir?)           -> arrival-order tickets `<time>-<pid>-<rand>`, each { pid, host, label, cwd, jobs, ts }
//   liveTickets(queue)       -> ticket names whose process is alive, oldest first (dead ones are deleted)
//   liveHolds(dir)           -> [{ name, ...record }] holds `slot-<ticket>` whose process is alive (dead ones are deleted)
//   limits(probes?)          -> { physical, budget, game } the budget in force now; a running game takes gameCores off it
//   snapshot(probes?)        -> everything the readout prints

import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { buildCores, physicalCores, readBudgetConfig, reserveCores } from './build-budget.mjs';
import { gameRunning } from './build-probes.mjs';

export const SLOT_PREFIX = 'slot-';

export const slotDir = () => process.env.CLAUDE_KIT_BUILD_SLOT_DIR || join(homedir(), '.claude', 'claude-kit-build-slots');
export const queueDir = (dir = slotDir()) => join(dir, 'queue');

export const alive = (rec) => {
  if (!rec || rec.host !== hostname() || !Number.isInteger(rec.pid)) return false;
  try { process.kill(rec.pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; }
};

export const readRec = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };

export function liveTickets(queue) {
  const names = [];
  for (const name of readdirSync(queue).sort()) {
    if (alive(readRec(join(queue, name)))) names.push(name);
    else rmSync(join(queue, name), { force: true });
  }
  return names;
}

export function liveHolds(dir = slotDir()) {
  mkdirSync(dir, { recursive: true });
  const holds = [];
  for (const name of readdirSync(dir).filter((n) => n.startsWith(SLOT_PREFIX))) {
    const rec = readRec(join(dir, name));
    if (alive(rec)) holds.push({ name, ...rec });
    else rmSync(join(dir, name), { force: true });
  }
  return holds.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

export function limits({ physicalCores: physical = physicalCores, gameRunning: game = gameRunning } = {}) {
  const cfg = readBudgetConfig();
  const cores = physical();
  const running = game(cfg.gameProcesses);
  const full = buildCores(cores, cfg);
  return { physical: cores, reserve: reserveCores(cfg), full, budget: running ? Math.max(1, full - cfg.gameCores) : full, game: running };
}

export function snapshot(probes) {
  const dir = slotDir();
  mkdirSync(queueDir(dir), { recursive: true });
  const waiting = liveTickets(queueDir(dir)).map((name) => ({ name, ...readRec(join(queueDir(dir), name)) }));
  return { ...limits(probes), holds: liveHolds(dir), waiting };
}
