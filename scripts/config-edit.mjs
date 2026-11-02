// config-edit.mjs — `t config get|set <dotted.key> …`: read or write one key of a project's
// `.ai/config.yml` (KIT-T836), e.g. `t config set broker.affected.conformance "cargo t -p game --test conformance"`.
//
//   setConfigKey(root, key, words) -> { path, key, value, previous, changed }
//   getConfigKey(root, key)        -> { key, value }   (value undefined when the key is unset)
//
// The edit is line-wise, so comments, ordering and every other key stay byte for byte; only the
// named key's line (and the lines of a block list it replaces) change, or one new line is added at
// the end of its parent block. A `broker.*` key must be one the broker reader reads, with a value
// of the shape it accepts (broker/config-schema.mjs); the edited text is parsed back and run
// through the reader before it is written, so a failed check leaves the file untouched.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker, parseYaml, stripComment } from './broker/config.mjs';
import { coerceBrokerValue } from './broker/config-schema.mjs';

const INDENT_STEP = 2;
const PLAIN = /^[A-Za-z0-9_./][A-Za-z0-9_./-]*$/;
const TYPED_LOOKALIKE = /^(true|false|null|~|-?\d+(\.\d+)?|-?\.\d+)$/i;
const BROKER = 'broker';

const significant = (line) => stripComment(line).trim() !== '';
const indentOf = (line) => line.match(/^ */)[0].length;

function yamlScalar(v) {
  if (typeof v !== 'string') return String(v);
  if (PLAIN.test(v) && !TYPED_LOOKALIKE.test(v)) return v;
  const single = !v.includes("'");
  const double = !v.includes('"');
  if (v.includes('\\') && single) return `'${v}'`;
  if (double) return `"${v}"`;
  if (single) return `'${v}'`;
  throw new Error(`a value holding both quote kinds cannot be written (got ${v})`);
}

const yamlValue = (v) => (Array.isArray(v) ? `[${v.map(yamlScalar).join(', ')}]` : yamlScalar(v));

function plainValue(words) {
  const typed = words.map((w) => (w === 'true' ? true : w === 'false' ? false : /^-?\d+$/.test(w) ? Number(w) : w));
  return typed.length === 1 ? typed[0] : typed;
}

function typedValue(segments, words) {
  if (!words.length) throw new Error('t config set: a value is required');
  if (segments[0] !== BROKER) return plainValue(words);
  return coerceBrokerValue(segments.slice(1).join('.'), words);
}

const dig = (doc, segments) => segments.reduce((node, s) => (node && typeof node === 'object' ? node[s] : undefined), doc);

function blockEnd(lines, idx, indent, limit) {
  for (let j = idx + 1; j < limit; j++) if (significant(lines[j]) && indentOf(lines[j]) <= indent) return j;
  return limit;
}

const lastSignificant = (lines, from, to) => {
  for (let j = to - 1; j >= from; j--) if (significant(lines[j])) return j;
  return from - 1;
};

// Walk the dotted path down the indentation: the line of the key when it exists, else where its first missing segment belongs.
function locate(lines, segments, key) {
  let start = 0;
  let end = lines.length;
  let parentIndent = -INDENT_STEP;
  for (let k = 0; k < segments.length; k++) {
    const first = lines.slice(start, end).find(significant);
    const indent = first === undefined ? parentIndent + INDENT_STEP : indentOf(first);
    if (first !== undefined && first.trim().startsWith('- ')) throw new Error(`t config: ${segments.slice(0, k).join('.')} is a list, not a map holding ${segments[k]}`);
    const re = new RegExp(`^ {${indent}}${segments[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(?:\\s|$)`);
    let idx = -1;
    for (let i = start; i < end; i++) if (re.test(lines[i]) && significant(lines[i])) { idx = i; break; }
    if (idx < 0) return { missing: k, insertAt: lastSignificant(lines, start, end) + 1 || start, indent };
    if (k === segments.length - 1) return { idx, indent, end: blockEnd(lines, idx, indent, end) };
    if (stripComment(lines[idx]).slice(indent + segments[k].length + 1).trim()) throw new Error(`t config: ${segments.slice(0, k + 1).join('.')} holds an inline value in ${key}; edit it by hand`);
    start = idx + 1;
    end = blockEnd(lines, idx, indent, end);
    parentIndent = indent;
  }
  return null;
}

function applyEdit(lines, segments, value, key) {
  const at = locate(lines, segments, key);
  const out = lines.slice();
  if (at.idx === undefined) {
    const added = segments.slice(at.missing).map((s, j, rest) => `${' '.repeat(at.indent + j * INDENT_STEP)}${s}:${j === rest.length - 1 ? ` ${yamlValue(value)}` : ''}`);
    out.splice(at.insertAt, 0, ...added);
    return out;
  }
  const lastChild = lastSignificant(lines, at.idx + 1, at.end);
  const children = lines.slice(at.idx + 1, lastChild + 1).filter(significant);
  if (children.some((c) => !c.trim().startsWith('- '))) throw new Error(`t config: ${key} is a map; set one of its keys`);
  const own = stripComment(lines[at.idx]);
  const note = lines[at.idx].slice(own.length);
  const comment = note ? own.match(/\s*$/)[0] + note : '';
  out.splice(at.idx, lastChild - at.idx + 1, `${' '.repeat(at.indent)}${segments[segments.length - 1]}: ${yamlValue(value)}${comment}`);
  return out;
}

function readText(root) {
  const path = join(root, '.ai', 'config.yml');
  try {
    return { path, text: readFileSync(path, 'utf8') };
  } catch {
    throw new Error(`t config: no ${path} to edit`);
  }
}

const splitKey = (key) => {
  const segments = String(key || '').split('.').filter(Boolean);
  if (!segments.length) throw new Error('t config: a dotted key is required, e.g. broker.affected.conformance');
  return segments;
};

export function getConfigKey(root, key) {
  return { key, value: dig(parseYaml(readText(root).text) || {}, splitKey(key)) };
}

export function setConfigKey(root, key, words) {
  const segments = splitKey(key);
  const value = typedValue(segments, words);
  const { path, text } = readText(root);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const trailing = lines[lines.length - 1] === '' ? lines.pop() !== undefined : false;
  const edited = applyEdit(lines, segments, value, key);
  const next = edited.join(eol) + (trailing ? eol : '');
  const doc = parseYaml(next) || {};
  const readBack = JSON.stringify(dig(doc, segments));
  if (readBack !== JSON.stringify(value)) throw new Error(`t config: ${key} read back as ${readBack}, not ${JSON.stringify(value)}; ${path} is unchanged`);
  if (segments[0] === BROKER) normalizeBroker(root, doc.broker || {});
  const previous = dig(parseYaml(text) || {}, segments);
  if (next !== text) writeFileSync(path, next);
  return { path, key, value, previous, changed: next !== text };
}

const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

/** The `t config` verb: returns the line to print. */
export function runConfig(root, rest) {
  const [action, key, ...words] = rest;
  if (action === 'get' && key) {
    const { value } = getConfigKey(root, key);
    return value === undefined ? `${key}: (unset)` : `${key}: ${show(value)}`;
  }
  if (action === 'set' && key) {
    const r = setConfigKey(root, key, words);
    if (!r.changed) return `${key}: already ${show(r.value)}`;
    return `${key}: ${r.previous === undefined ? '(unset)' : show(r.previous)} -> ${show(r.value)}`;
  }
  throw new Error('usage');
}
