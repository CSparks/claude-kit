// t/labels.mjs — add / remove one label on a frontmatter block's inline `labels: [a, b]` list.

import { listField } from '../frontmatter.mjs';
import { setField } from './ticket-file.mjs';

const write = (fm, labels) => setField(fm, 'labels', `[${labels.join(', ')}]`);

export const hasLabel = (fm, label) => listField(fm, 'labels').includes(label);

export function addLabel(fm, label) {
  const labels = listField(fm, 'labels');
  return labels.includes(label) ? fm : write(fm, [...labels, label]);
}

export function removeLabel(fm, label) {
  const labels = listField(fm, 'labels');
  return labels.includes(label) ? write(fm, labels.filter((l) => l !== label)) : fm;
}
