// assistant-text — the prose of one assistant transcript entry (KIT-T893): every text block plus every narration block.
// Claude Code records the commentary it shows the maintainer between tool calls as a thinking block whose signature
// names "narration" and whose text is filled; ordinary thinking blocks carry an empty text and are never prose.
// A narration block is a platform-written summary of the commentary (KIT-T906): it drops labelled lines, so only a
// text block carries a brief's exact labels.
//
//   isNarration(block)            -> is the block a narration block
//   assistantBlocksOf(content)    -> [{ kind: 'text' | 'narration', text }] one per prose block, in order
//   assistantTextOf(content)      -> the entry's prose, blocks joined by newlines ('' when it holds none)

const NARRATION_SIGNATURE = 'narration';

export const isNarration = (b) => b.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim() !== ''
  && Buffer.from(String(b.signature || ''), 'base64').toString('latin1').includes(NARRATION_SIGNATURE);

export function assistantBlocksOf(content) {
  if (typeof content === 'string') return [{ kind: 'text', text: content }];
  if (!Array.isArray(content)) return [];
  return content
    .filter((b) => b && (b.type === 'text' || isNarration(b)))
    .map((b) => (b.type === 'text' ? { kind: 'text', text: b.text } : { kind: 'narration', text: b.thinking }))
    .filter((b) => typeof b.text === 'string');
}

export const assistantTextOf = (content) => assistantBlocksOf(content).map((b) => b.text).join('\n');
