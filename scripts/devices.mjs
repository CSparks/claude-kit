// devices.mjs — machine-level device / deploy-target registry, surfaced by orient so a project
// session knows the target exists and which kit script drives it (KIT-T406). Each device
// is { label, target(): { host, user, key }, games(): { <project>: game }, command(project),
// tail(target, project) }; add a device by appending to DEVICES.

import { homedir } from 'node:os';
import { discoverGames, readTarget } from './deck-config.mjs';

const slashed = (p) => p.replace(/\\/g, '/');
const KIT_SCRIPTS = slashed(import.meta.dirname);
const tilde = (p) => slashed(p).replace(slashed(homedir()), '~');

export const DEVICES = [
  {
    label: 'Steam Deck',
    target: readTarget,
    games: discoverGames,
    command: (project) => `node ${KIT_SCRIPTS}/deck-deploy.mjs ${project}`,
    tail: ({ user, host, key }, project) => `ssh -i ${tilde(key)} ${user}@${host} 'tail -n 50 ~/Games/${project}/last-run.log'`,
  },
];

/** One line per device `project` is a configured game for; [] when none (or a config is unreadable). */
export function deviceLines(project, devices = DEVICES) {
  const lines = [];
  for (const d of devices) {
    try {
      if (!d.games()[project]) continue;
      const t = d.target();
      lines.push(`  ${d.label} ${t.user}@${t.host}: ${d.command(project)} (build+push); log: ${d.tail(t, project)}`);
    } catch {
      /* device config absent or unreadable: nothing to announce */
    }
  }
  return lines;
}

/** The orientation block for `project`, or [] when no device applies. */
export function deviceBlock(project, devices = DEVICES) {
  const lines = deviceLines(project, devices);
  return lines.length ? ['--- DEVICES / DEPLOY TARGETS (you HAVE access; use the kit script) ---', ...lines, ''] : [];
}
