// brief-sections.mjs — the labelled sections of a prose brief, in the forms sessions write them.
//
//   sectionBody(text, labels) -> the body under the first section whose label matches, or '' when there is none
//     labels   regex source for the label words, e.g. 'recommend(?:ation|ed)?'
//     A label opens a line as `Label:`, `**Label:**`, `**Label.**`, `Label.`, `Label - ` or a `## Label` heading, with an
//     optional bullet or quote mark before it. The body is the rest of that line plus the lines after it up to the next
//     blank line; a label alone on its line takes the paragraph below it.
//   sentences(text) -> the text split into sentences

const LINE_MARKS = '[ \\t>*_#-]*';
const BOLD = '(?:\\*\\*|__)';
const LABEL_END = `(?:${BOLD}[ \\t]*[:.\\u2014]?|[:.\\u2014]|[ \\t]+[-\\u2014][ \\t]|[ \\t]*$)`;
const PARAGRAPH_BREAK = /\n[ \t]*\n/;

export function sectionBody(text, labels) {
  const opener = new RegExp(`^${LINE_MARKS}${BOLD}?(?:${labels})${LABEL_END}${BOLD}?[:.]?`, 'im');
  const found = opener.exec(text);
  if (!found) return '';
  const rest = text.slice(found.index + found[0].length);
  const sameLine = rest.split('\n', 1)[0].trim();
  const paragraph = (sameLine ? rest : rest.replace(/^[ \t]*\n+/, '')).split(PARAGRAPH_BREAK, 1)[0];
  return paragraph.replace(/\s+/g, ' ').trim();
}

export const sentences = (text) => String(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
