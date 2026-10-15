// control.mjs — operator controls for a running broker (KIT-T276): `pause` makes the daemon
// stop starting jobs (the job in flight finishes) so a hand edit can use the tree; `resume`
// lifts it. State is one marker file in the broker home, so it survives a daemon restart.

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDirs } from './result.mjs';

const marker = (cfg) => join(ensureDirs(cfg).home, 'paused');

export const isPaused = (cfg) => existsSync(marker(cfg));

export function pause(cfg) {
  writeFileSync(marker(cfg), new Date().toISOString());
}

export function resume(cfg) {
  rmSync(marker(cfg), { force: true });
}

const stopMarker = (cfg) => join(ensureDirs(cfg).home, 'stop');

export const stopRequested = (cfg) => existsSync(stopMarker(cfg));
export const requestStop = (cfg) => writeFileSync(stopMarker(cfg), new Date().toISOString());
export const clearStop = (cfg) => rmSync(stopMarker(cfg), { force: true });
