// q-project.mjs — resolve a `--project <name>` token to that project's id scope key, with the
// SAME matching cap uses for its own `--project` (cap-routing: registry name or id key, case
// insensitive). An unknown name is an error, never a silent fall-through to the cwd project.

import { existsSync } from 'node:fs';
import { matchProject, projectTable } from './cap-routing.mjs';
import { readRegistry } from '../hooks/lib.mjs';

const KNOWN_SHOWN = 12;

function unknownMessage(name, table) {
  const names = table.map((p) => p.name).sort();
  const known = names.length ? `${names.slice(0, KNOWN_SHOWN).join(', ')}${names.length > KNOWN_SHOWN ? `, +${names.length - KNOWN_SHOWN} more` : ''}` : 'none registered';
  return `unknown project '${name}' � registered: ${known}.`;
}

/** The upper-cased id key (scope) of the registered project `name` names. Throws on a miss. */
export function projectScope(name, table = projectTable()) {
  const hit = matchProject(table, name);
  if (!hit) {
    const names = table.map((p) => p.name).sort();
    const known = names.length ? `${names.slice(0, KNOWN_SHOWN).join(', ')}${names.length > KNOWN_SHOWN ? `, +${names.length - KNOWN_SHOWN} more` : ''}` : 'none registered';
    throw new Error(`unknown project '${name}' — registered: ${known}.`);
  }
  if (!hit.key) throw new Error(`project '${hit.name}' has no ids.key in its config.yml, so it has no scope to search.`);
  return hit.key.toUpperCase();
}

/** The checkout directory of the registered project `name` names; throws on an unknown or repo-less project. */
export function projectRepo(name, table = projectTable(), registry = readRegistry()) {
  const hit = matchProject(table, name);
  if (!hit) throw new Error(unknownMessage(name, table));
  const repo = registry.projects?.[hit.name];
  if (!repo || !existsSync(repo)) throw new Error(`project '${hit.name}' has no checkout on this machine, so it has no code to search.`);
  return repo;
}
