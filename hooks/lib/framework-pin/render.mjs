// framework-pin/render.mjs — the SessionStart block for one framework submodule (KIT-D141): a plain text block
// headed `--- FRAMEWORK PIN (KIT-D141) ---`, one `!!` line per condition that needs the session's attention.
//
//   renderPin({ name, state, delta, forecast, fetch, held, others }) -> string (no trailing newline)

const SHORT = 7;
const MS_PER_MIN = 60_000;
const MIN_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SHOWN_PATHS = 3;
const short = (sha) => (sha || '').slice(0, SHORT) || 'none';
const list = (items, shown = SHOWN_PATHS) => `${items.slice(0, shown).join(', ')}${items.length > shown ? ` +${items.length - shown} more` : ''}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function ageText(ms) {
  if (ms === null || ms === undefined) return 'a fetch that never ran here';
  const minutes = Math.max(0, Math.round(ms / MS_PER_MIN));
  if (minutes < MIN_PER_HOUR) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.round(minutes / MIN_PER_HOUR);
  return hours < HOURS_PER_DAY ? `${plural(hours, 'hour')} ago` : `${plural(Math.round(hours / HOURS_PER_DAY), 'day')} ago`;
}

function alerts({ name, state, forecast, fetch }) {
  const out = [];
  if (!fetch.ok) out.push(`!! FETCH FAILED (${fetch.reason}): judged against refs from ${ageText(fetch.refAgeMs)}`);
  if (!state.origin) out.push(`!! the ${name} submodule has no origin/main ref to compare the pin with`);
  if (state.behind) out.push(`!! ${name} is BEHIND origin/main by ${plural(state.behind, 'commit')}: pull and pin now (KIT-D141)`);
  if (state.gitlink && state.origin && state.gitlinkKnown && !state.gitlinkOnOrigin) out.push(`!! the recorded pin ${short(state.gitlink)} is not on origin/main`);
  const work = [];
  if (state.trackedEdits.length) work.push(plural(state.trackedEdits.length, 'tracked edit'));
  if (state.untracked.length) work.push(plural(state.untracked.length, 'untracked file'));
  if (state.localCommits.length) work.push(plural(state.localCommits.length, 'local commit') + ' not on origin/main');
  if (work.length) out.push(`!! LOCAL ${name.toUpperCase()} WORK: ${work.join(', ')}`);
  if (forecast.overlaps.length) out.push(`!! CONFLICT FORECAST: your edits overlap upstream in ${list(forecast.overlaps)}`);
  if (forecast.collisions.length) out.push(`!! CONFLICT FORECAST: untracked ${list(forecast.collisions)} would collide with files origin/main adds`);
  if (forecast.merge === 'conflicts') out.push(`!! CONFLICT FORECAST: your local commits conflict with origin/main in ${list(forecast.mergeFiles) || 'unlisted paths'}`);
  return out;
}

function deltaLines({ state, delta }) {
  if (!state.behind) return [];
  const out = [`delta ${short(state.gitlink)}..${short(state.origin)}: ${plural(state.behind, 'commit')}`];
  out.push(...delta.subjects.map((s) => `  ${s}`));
  if (delta.more) out.push(`  +${delta.more} more`);
  if (delta.crates.length) out.push(`changed crates: ${list(delta.crates, delta.crates.length)}`);
  if (delta.mayBreak.length) out.push(`may break: ${list(delta.mayBreak, delta.mayBreak.length)} (a build confirms)`);
  else if (delta.crates.length) out.push('may break: none of your crates depend on them');
  if (delta.wide) out.push('a workspace-level file changed: a full build check is the safe scope');
  return out;
}

export function renderPin(ctx) {
  const { name, state, fetch, held, others } = ctx;
  const head = state.head && state.head !== state.gitlink ? `, checkout ${short(state.head)}${state.branch ? ` on ${state.branch}` : ''}` : '';
  const lines = [
    '--- FRAMEWORK PIN (KIT-D141) ---',
    `${name}: pin ${short(state.gitlink)} | origin/main ${short(state.origin)} | behind ${state.behind} / ahead ${state.ahead}${head}${fetch.attempted ? '' : ' | fetch skipped'}`,
  ];
  if (held) lines.push('broker holds the tree: reported from the recorded pin and origin/main only');
  lines.push(...deltaLines(ctx), ...alerts(ctx));
  if (others.length) lines.push(`other consumers' pins: ${others.map((o) => `${o.name} ${short(o.sha)}`).join(', ')}`);
  return lines.join('\n');
}
