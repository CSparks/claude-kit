// dispatch-unattended.mjs — a brief into a rapid-game repo that orders a windowed game run (launch check, probe flight,
// screenshot capture) without naming RG_UNATTENDED is told to add it (KIT-T1492): a run started without it locks the
// cursor and takes focus on the maintainer's desktop. A warning, never a block.
//
//   unattendedWarning({ root, input, prompt }) -> '' | one NOTE line
//   UNATTENDED_CHECK                           -> the check id, for the ignore file
// A clause that forbids the run ("do not launch the game") orders nothing. A repo that does not use rapid-game is not judged.

import { dispatchTargetRoot } from './dispatch-target.mjs';
import { frameworksFor } from './lib/frameworks.mjs';

export const UNATTENDED_CHECK = 'dispatch-unattended';
const FRAMEWORK_NAME = 'rapid-game';
const ENV_NAME = 'RG_UNATTENDED';
const NEGATION = /\b(?:never|don'?t|do not|must not|cannot|can'?t|not|no|without|avoid|skip|instead of)\b/i;
const NEGATION_REACH = 60;
const CLAUSE_END = /[.;\n]/;

const GAME_RUNS = [
  /\blaunch[- ]checks?\b/gi,
  /\bprobe[- ]flights?\b/gi,
  /\bscreenshot[- ]captures?\b|\bcapture (?:the )?screenshots?\b/gi,
  /\basset[_-]shots?\b|\bowner[_-]shots?\b/gi,
  /\b(?:start|run|launch)\s+the\s+(?:game|demo)\b/gi,
];

const ordered = (text, m) => !NEGATION.test(text.slice(0, m.index).split(CLAUSE_END).pop().slice(-NEGATION_REACH));

export function gameRunOrders(prompt) {
  const text = String(prompt || '');
  return [...new Set(GAME_RUNS.flatMap((re) => [...text.matchAll(re)].filter((m) => ordered(text, m)).map((m) => m[0].toLowerCase())))];
}

function usesFramework(root, input) {
  try { return frameworksFor(dispatchTargetRoot(root, input)).some((f) => f.name === FRAMEWORK_NAME); } catch { return false; }
}

export function unattendedWarning({ root, input, prompt }) {
  const brief = String(prompt || '');
  if (brief.includes(ENV_NAME)) return '';
  const runs = gameRunOrders(brief);
  if (!runs.length || !usesFramework(root, input)) return '';
  return `NOTE: this brief orders a game run (${runs.slice(0, 3).map((r) => `"${r}"`).join(', ')}) without naming ${ENV_NAME} (KIT-T1492): a run without ${ENV_NAME}=1 locks the cursor and takes focus on the maintainer's desktop. Add "set ${ENV_NAME}=1 on every game run".`;
}
