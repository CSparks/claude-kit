// Is a delegation READ-ONLY — counted by no one, blocked by no one. The one-writer-per-checkout
// rule (KIT-D077) prices the edit->build->measure loop; an agent that cannot write has none.
//
// Read-only when any of:
//   - a built-in analytical type (Explore, Plan, claude-code-guide);
//   - its definition's `tools:` frontmatter grants no Edit/Write/NotebookEdit/MultiEdit and no `*`
//     (plugin, project `.claude/agents/`, superproject and user definitions — model-tag.mjs);
//   - the dispatcher declared it: `[read-only: <reason>]` in the prompt, recorded on the roster row.
// Unknown types and all-tools definitions are writers.

import { definitionTools } from './model-tag.mjs';

const WRITE_TOOLS = /^(Edit|Write|NotebookEdit|MultiEdit)$/i;
const BUILTIN_READ_ONLY = new Set(['explore', 'plan', 'claude-code-guide']);
const READ_ONLY_TOKEN = /\[read-only:\s*([^\]\s][^\]]*)\]/i;

// The reason a dispatcher gave for treating a writer-capable type as read-only, or ''.
export function declaredReadOnly(prompt) {
  const m = String(prompt || '').match(READ_ONLY_TOKEN);
  return m ? m[1].trim() : '';
}

export function readOnlyType(root, type) {
  const name = String(type || '').split(':').pop().trim().toLowerCase();
  if (BUILTIN_READ_ONLY.has(name)) return true;
  const tools = definitionTools(root, type);
  return Array.isArray(tools) && !tools.some((t) => WRITE_TOOLS.test(t));
}

export function readOnlyDispatch(root, type, prompt) {
  return !!declaredReadOnly(prompt) || readOnlyType(root, type);
}

// A roster row is read-only by its recorded declaration or by its scope's definition.
export function readOnlyRow(root, row) {
  return !!(row && row.readOnly) || readOnlyType(root, row && row.scope);
}
