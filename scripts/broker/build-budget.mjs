// build-budget.mjs — the machine-wide Rust build budget (KIT-D135). Every project's cargo, nextest and
// cargo-ndk builds share one core budget: the PHYSICAL cores minus a reserve that is never built on.
// The core count comes from the OS and is cached beside the config; no machine size is named here.
//
//   physicalCores()             -> OS physical core count (CLAUDE_KIT_PHYSICAL_CORES overrides, tests)
//   reserveCores(cfg?)          -> cores kept free: the configured value, never below MIN_RESERVE_CORES
//   buildCores(physical?, cfg?) -> the budget in cores, at least 1
//   readBudgetConfig(file?)     -> { reserveCores, gameCores, gameProcesses } from ~/.claude/claude-kit-build-budget.json

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism, homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';

export const MIN_RESERVE_CORES = 2;
const DEFAULT_GAME_CORES = 6;
const DEFAULT_GAME_PROCESSES = ['^stiletto(-editor)?$', '^dirt-empire$', '^gridiron-blitz$'];
const DECIMAL = 10;

export const budgetConfigPath = () => process.env.CLAUDE_KIT_BUILD_BUDGET_FILE || join(homedir(), '.claude', 'claude-kit-build-budget.json');
const machineCachePath = () => join(dirname(budgetConfigPath()), 'claude-kit-machine.json');

export function readBudgetConfig(file = budgetConfigPath()) {
  let raw = {};
  try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch { /* defaults */ }
  const count = (v, fallback) => (Number.isInteger(v) && v >= 0 ? v : fallback);
  return {
    reserveCores: count(raw.reserveCores, MIN_RESERVE_CORES),
    gameCores: count(raw.gameCores, DEFAULT_GAME_CORES),
    gameProcesses: Array.isArray(raw.gameProcesses) ? raw.gameProcesses.map(String) : DEFAULT_GAME_PROCESSES,
  };
}

const POWERSHELL_CORES = '(Get-CimInstance Win32_Processor | Measure-Object NumberOfCores -Sum).Sum';

function detectPhysicalCores() {
  const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    if (process.platform === 'win32') return parseInt(run('powershell', ['-NoProfile', '-Command', POWERSHELL_CORES]), DECIMAL);
    if (process.platform === 'darwin') return parseInt(run('sysctl', ['-n', 'hw.physicalcpu']), DECIMAL);
    const rows = run('lscpu', ['-p=CORE,SOCKET']).split('\n').filter((l) => l && !l.startsWith('#'));
    return new Set(rows).size;
  } catch { return NaN; }
}

export function physicalCores() {
  const forced = Number(process.env.CLAUDE_KIT_PHYSICAL_CORES);
  if (Number.isInteger(forced) && forced > 0) return forced;
  const cache = machineCachePath();
  try {
    const rec = JSON.parse(readFileSync(cache, 'utf8'));
    if (rec.host === hostname() && Number.isInteger(rec.physicalCores) && rec.physicalCores > 0) return rec.physicalCores;
  } catch { /* detect */ }
  const found = detectPhysicalCores();
  if (!(found > 0)) return availableParallelism();
  try {
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, JSON.stringify({ host: hostname(), physicalCores: found }));
  } catch { /* an unwritable cache only costs a re-detect */ }
  return found;
}

export const reserveCores = (cfg = readBudgetConfig()) => Math.max(MIN_RESERVE_CORES, cfg.reserveCores);

export const buildCores = (physical = physicalCores(), cfg = readBudgetConfig()) => Math.max(1, physical - reserveCores(cfg));
