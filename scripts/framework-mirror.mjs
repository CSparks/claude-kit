#!/usr/bin/env node
// framework-mirror.mjs — a framework-scope decision recorded in a game store is mirrored into the framework's own store
// as an open ticket the same turn (KIT-T943), so the framework session sees and builds it instead of orient merely listing it
// as unpromoted (KIT-D111). The decision gets `promoted: <ticket id>`, which clears the D111 flag.
//
//   mirrorDecision(root, decisionPath) -> { ticket, path, aiDir } | null
//     null when `root` is the framework store or does not consume the framework (frameworks/rapid-game.md detection), the
//     machine registry has no framework project, the decision is game-scope, or it already carries `promoted:`. The ticket lands in the framework project's store directory (repo or central data root).
//   node scripts/framework-mirror.mjs --root <game repo> --decision <id>   mirrors one recorded decision (backfill)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classificationKeys } from './cap-routing.mjs';
import { field, frontmatterBlock, splitFrontmatter } from './frontmatter.mjs';
import { reserveId } from './id-reserve.mjs';
import { writeFromTemplate } from './triage/write-item.mjs';
import { fileForId, maxStoreNum, readIdConfig } from './id-utils.mjs';
import { projectName } from '../hooks/lib/paths.mjs';
import { consumesFramework, frameworkAiDir, isFrameworkDecision, isFrameworkStore } from '../hooks/lib/framework-scope.mjs';

const TICKET_TYPES = ['task', 'chore', 'feature'];
const BODY_CHARS = 1500;
const TICKET_PRIORITY = 'high';
const MIRROR_LABEL = 'framework-decision';

const mirrorType = (aiDir) => {
  const keys = classificationKeys(join(aiDir, 'config.yml'));
  return TICKET_TYPES.find((t) => keys.includes(t)) || keys[0] || 'task';
};

const ticketBody = ({ project, id, date, summary, path, body }) => [
  `Mirrored from the ${project} decision ${id}${date ? ` (${date})` : ''}: the maintainer ruled this a framework concern, so the framework store carries it as work (KIT-T943).`,
  summary ? `Summary: ${summary}` : '',
  `Decision file: ${path}`,
  '',
  body.slice(0, BODY_CHARS),
  '',
  `Build it in the framework, or record why not on this ticket; close it against the landing commit. The ${project} decision points back here with promoted:.`,
].filter((l, i, all) => l !== '' || all[i - 1] !== '').join('\n');

// Frontmatter keys set in place, or added before the closing fence when the store has no template carrying them.
function withFields(text, fields) {
  return Object.entries(fields).reduce((out, [key, value]) => (
    new RegExp(`^${key}:`, 'm').test(out) ? out.replace(new RegExp(`^${key}:.*$`, 'm'), () => `${key}: ${value}`) : out.replace(/\r?\n---/, () => `\n${key}: ${value}\n---`)
  ), text);
}

function stampPromoted(path, ticket) {
  const text = readFileSync(path, 'utf8');
  const split = splitFrontmatter(text);
  if (!split) return;
  writeFileSync(path, text.replace(/^---\r?\n/, `---\npromoted: ${ticket}\n`));
}

function nextTicketId(aiDir) {
  const { key, pad } = readIdConfig(aiDir, aiDir);
  if (!key) throw new Error(`no ids.key in ${join(aiDir, 'config.yml')}`);
  return reserveId({ root: aiDir, store: 'tickets', key, pad, floor: maxStoreNum(aiDir, 'tickets', aiDir) }).id;
}

export function mirrorDecision(root, decisionPath) {
  const aiDir = frameworkAiDir();
  const text = readFileSync(decisionPath, 'utf8');
  const fm = frontmatterBlock(text);
  const meta = { id: field(fm, 'id'), title: field(fm, 'title') || '', summary: field(fm, 'summary') || '', date: field(fm, 'date') || '' };
  if (!aiDir || !meta.id || field(fm, 'promoted') || isFrameworkStore(root) || !consumesFramework(root) || !isFrameworkDecision(meta)) return null;
  const ticket = nextTicketId(aiDir);
  const rel = writeFromTemplate({
    aiDir, store: 'tickets', id: ticket, type: mirrorType(aiDir), priority: TICKET_PRIORITY, title: `Framework decision ${meta.id}: ${meta.title}`,
    links: [meta.id], text: ticketBody({ project: projectName(root), ...meta, path: decisionPath, body: splitFrontmatter(text)?.rest.trim() || '' }),
  });
  const file = join(aiDir, rel);
  writeFileSync(file, withFields(readFileSync(file, 'utf8'), { status: 'todo', labels: `[${MIRROR_LABEL}]` }));
  stampPromoted(decisionPath, ticket);
  return { ticket, path: file, aiDir };
}

export function mirrorById(root, id) {
  const file = fileForId(join(root, '.ai'), id);
  if (!file) throw new Error(`framework-mirror: no decision '${id}' in ${join(root, '.ai')}`);
  return mirrorDecision(root, join(root, '.ai', file));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
  const root = resolve(arg('root') || process.cwd());
  const id = arg('decision');
  if (!id) { console.error('usage: node scripts/framework-mirror.mjs --root <game repo> --decision <id>'); process.exit(2); }
  const r = mirrorById(root, id);
  console.log(r ? `${id} mirrored to ${r.ticket} (${r.path})` : `${id}: not mirrored (game-scope, already promoted, or no framework project)`);
}
