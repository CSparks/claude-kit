// assistant-text — the prose of one assistant transcript entry (KIT-T893): every text block plus every narration block.
// Claude Code records the commentary it shows the maintainer between tool calls as a thinking block whose signature
// names "narration" and whose text is filled; ordinary thinking blocks carry an empty text and are never prose.
//
//   isNarration(block)            -> is the block a narration block
//   assistantTextOf(content)      -> the entry's prose, blocks joined by newlines ('' when it holds none)

const NARRATION_SIGNATURE = 'narration';

export const isNarration = (b) => b.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim() !== ''
  && Buffer.from(String(b.signature || ''), 'base64').toString('latin1').includes(NARRATION_SIGNATURE);

export function assistantTextOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && (b.type === 'text' || isNarration(b)))
    .map((b) => (b.type === 'text' ? b.text : b.thinking))
    .filter((t) => typeof t === 'string')
    .join('\n');
}
