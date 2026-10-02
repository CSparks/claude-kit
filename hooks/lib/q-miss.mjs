// Capability-miss detection for the search telemetry (KIT-T286): a grep within a few calls after
// a q that came back empty or failed, for overlapping terms, means q could not answer something
// an agent needed — that is a kit bug, filed as a ticket, never a silent fallback.
//
//   noteSearch(root, row, response, project) -> filed { id } | null   (state: turn-state slot q-miss)

import { readTurnState, writeTurnState } from './turn-state.mjs';

const SLOT = 'q-miss';
const WINDOW_CALLS = 5;
const MIN_TERM = 3;

const words = (s) => new Set(String(s || '').toLowerCase().split(/[^a-z0-9_]+/).filter((w) => w.length >= MIN_TERM));

/** Flatten a PostToolUse tool_response (string | { stdout, stderr } | content blocks) to text. */
export function responseText(resp) {
  if (!resp) return '';
  if (typeof resp === 'string') return resp;
  if (Array.isArray(resp)) return resp.map(responseText).join('\n');
  return [resp.stdout, resp.stderr, resp.output, resp.text].filter((x) => typeof x === 'string').join('\n');
}

const emptyOrFailed = (text) => /\(no results\)/.test(text) || /^q: /m.test(text) || !text.trim();

export async function noteSearch(root, row, response, project) {
  const state = readTurnState(root, SLOT);
  if (row.kind === 'q') {
    if (emptyOrFailed(responseText(response))) {
      const cmd = `q ${row.verb || ''} ${row.queryText || ''}`.trim();
      writeTurnState(root, { terms: [...words(row.queryText)], cmd, calls: 0 }, SLOT);
    } else if (state) writeTurnState(root, {}, SLOT);
    return null;
  }
  if (!state || !state.terms || !state.terms.length) return null;
  const calls = (state.calls || 0) + 1;
  if (calls > WINDOW_CALLS) { writeTurnState(root, {}, SLOT); return null; }
  const overlap = [...words(`${row.pattern} ${row.queryText || ''}`)].some((w) => state.terms.includes(w));
  if (!overlap) { writeTurnState(root, { ...state, calls }, SLOT); return null; }
  writeTurnState(root, {}, SLOT);
  const { fileKitBug } = await import('../../scripts/kit-bug.mjs');
  const verb = state.cmd.split(' ')[1] || 'query';
  return fileKitBug({
    shape: `q-gap:grep-after-empty-q:${verb}`,
    title: `q gap: a grep followed an empty q ${verb} for the same terms`,
    detail: `q: ${state.cmd}  then  ${row.kind}: ${row.pattern}`,
    project,
  });
}
