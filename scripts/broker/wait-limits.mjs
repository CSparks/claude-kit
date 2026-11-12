// wait-limits.mjs — how long wait.mjs may block so its Bash call never outlives the harness (KIT-T851, KIT-T1104).
// The harness moves a foreground call to the background at its own timeout (120 s when none is named) and never
// later than HARNESS_FOREGROUND_S whatever timeout the call names, stripping its console. The caller names a longer
// window with --tool-timeout <s> (the Bash call's own timeout); wait ends itself TOOL_MARGIN_S before it, with exit
// 2 and the running line. A subagent's wait is always a foreground call, so the harness cap bounds it too; the main
// thread may run wait in the background and name a window beyond the cap.

export const HARNESS_FOREGROUND_S = 180;
export const DEFAULT_TOOL_TIMEOUT_S = 120;
export const TOOL_MARGIN_S = 10;
export const DEFAULT_WAIT_S = 100;
export const MAX_FOREGROUND_WAIT_S = HARNESS_FOREGROUND_S - TOOL_MARGIN_S;

/** The seconds wait may block: the asked-for --timeout, cut to fit the tool window (and the harness cap for a subagent). */
export function waitWindow(flags, { subagent = false } = {}) {
  const asked = Number(flags.timeout) || DEFAULT_WAIT_S;
  const named = Number(flags['tool-timeout']) || DEFAULT_TOOL_TIMEOUT_S;
  const tool = subagent ? Math.min(named, HARNESS_FOREGROUND_S) : named;
  const ceiling = Math.max(tool - TOOL_MARGIN_S, 1);
  return { seconds: Math.min(asked, ceiling), clamped: asked > ceiling, asked, ceiling, capped: subagent && named > HARNESS_FOREGROUND_S };
}
