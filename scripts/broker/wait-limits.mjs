// wait-limits.mjs — how long wait.mjs may block so its Bash call never outlives the harness (KIT-T851).
// A foreground call with no timeout argument is moved to the background at 120 s and its console stripped;
// the caller names a longer window with --tool-timeout <s> (the Bash call's own timeout), and wait ends
// itself TOOL_MARGIN_S before it, with exit 2 and the running line.

export const DEFAULT_TOOL_TIMEOUT_S = 120;
export const TOOL_MARGIN_S = 10;
export const DEFAULT_WAIT_S = 100;

/** The seconds wait may block: the asked-for --timeout, cut to fit the tool window. */
export function waitWindow(flags) {
  const asked = Number(flags.timeout) || DEFAULT_WAIT_S;
  const tool = Number(flags['tool-timeout']) || DEFAULT_TOOL_TIMEOUT_S;
  const ceiling = Math.max(tool - TOOL_MARGIN_S, 1);
  return { seconds: Math.min(asked, ceiling), clamped: asked > ceiling, asked, ceiling };
}
