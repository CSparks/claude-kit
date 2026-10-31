// decisions.mjs — the decision sections of orientation: foundational identity, standing decisions in scope, the
// recent ones, and the kit's recent decisions (KIT-T071, KIT-T507).
//
//   decisionViews(root) -> { recentDecisions(n), standingDecisions(signals, changed), foundationalDecisions() }
//   standingSection(ctx, views, signals, changed)  pushes the in-scope standing decisions; returns them
//   recentSection(ctx, views, decisionsFile)       pushes the recent decisions (a decisions/ directory or legacy DECISIONS.md)
//   kitDecisionsSection(ctx)                       replays the kit's recent decisions

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { globToRegExp } from '../../lib.mjs';
import { pathKey, statCached, statMarkdownFiles } from '../stat-cache.mjs';
import { DECISIONS_DIR_RECENT, DECISIONS_GIST_LINES, clip, lineCount, tail } from './common.mjs';

const stripQuotes = (s) => (s || '').trim().replace(/^["']|["']$/g, '').trim();

const readDecisionMeta = (abs) => {
  const f = basename(abs);
  try {
    const t = readFileSync(abs, 'utf8');
    const id = (t.match(/^id:[ \t]*(.+)$/m) || [])[1];
    const title = (t.match(/^title:[ \t]*(.+)$/m) || [])[1];
    const standing = /^standing:[ \t]*(true|yes)\b/im.test(t);
    // A foundational decision is ALWAYS surfaced (top of orient), never scope-gated: it states what the project IS.
    const foundational = /^foundational:[ \t]*(true|yes)\b/im.test(t);
    // A standing decision declares its own relevance: `scope:` (free token) and/or `paths:` (comma globs).
    const scope = stripQuotes((t.match(/^scope:[ \t]*(.+)$/m) || [])[1]);
    const paths = stripQuotes((t.match(/^paths:[ \t]*(.+)$/m) || [])[1])
      .split(',').map((s) => s.trim()).filter(Boolean);
    return { id: id ? id.trim() : '', title: title ? stripQuotes(title) : f.replace(/\.md$/, ''), standing, foundational, scope, paths };
  } catch {
    return { id: '', title: f.replace(/\.md$/, ''), standing: false, foundational: false, scope: '', paths: [] };
  }
};

export function decisionViews(root) {
  const decisionFiles = () => {
    try {
      return readdirSync(join(root, '.ai', 'decisions')).filter((f) => f.endsWith('.md') && !/^(README|_TEMPLATE)/i.test(f)).sort();
    } catch {
      return null;
    }
  };
  // Front-matter is read once per file change (stat-keyed cache): a store of hundreds would cost one open each.
  let metaByFile = null;
  const decisionMeta = (f) => {
    if (!metaByFile) {
      const dir = join(root, '.ai', 'decisions');
      const files = statMarkdownFiles(dir);
      const metas = statCached(`decision-meta-${pathKey(dir)}`, files, readDecisionMeta);
      metaByFile = new Map(files.map((fl, i) => [fl.name, metas[i]]));
    }
    return metaByFile.get(f) || readDecisionMeta(join(root, '.ai', 'decisions', f));
  };
  const recentDecisions = (n) => {
    const files = decisionFiles();
    if (!files) return '';
    const shown = files.slice(-n).map((f) => {
      const { id, title } = decisionMeta(f);
      return `  ${id ? id + ' — ' : ''}${clip(title, 120)}`;
    }).join('\n');
    const more = files.length > n ? `  +${files.length - n} more — full: q decisions` : '';
    return shown + (more ? '\n' + more : '');
  };
  // STANDING decisions are the anti-relitigation backbone: surfaced only when in scope (`paths:` use lib's one glob dialect).
  const standingDecisions = (signals, changed) => {
    const files = decisionFiles();
    if (!files) return null;
    const all = files.map(decisionMeta).filter((m) => m.standing && !m.foundational);
    if (!all.length) return null;
    const sig = signals.toLowerCase();
    const inScope = (m) => {
      if (!m.scope && !m.paths.length) return true;
      if (m.scope && sig.includes(m.scope.toLowerCase())) return true;
      return m.paths.some((g) => { const re = globToRegExp(g); return changed.some((p) => re.test(p)); });
    };
    const shown = all.filter(inScope);
    const deferred = all.filter((m) => !inScope(m));
    return {
      shown: shown.map((m) => `  ${m.id ? m.id + ' — ' : ''}${clip(m.title, 120)}`).join('\n'),
      shownIds: shown.map((m) => m.id).filter(Boolean),
      deferredCount: deferred.length,
      deferredScopes: [...new Set(deferred.map((m) => m.scope).filter(Boolean))].sort(),
    };
  };
  const foundationalDecisions = () => {
    const files = decisionFiles();
    return files ? files.map(decisionMeta).filter((m) => m.standing && m.foundational) : [];
  };
  return { recentDecisions, standingDecisions, foundationalDecisions };
}

export function standingSection({ out }, views, signals, changed) {
  const standing = views.standingDecisions(signals, changed);
  if (standing && (standing.shown || standing.deferredCount)) {
    out.push('');
    out.push('--- STANDING decisions in scope (settled — CITE, never re-ask or relitigate) ---');
    if (standing.shown) out.push(standing.shown);
    if (standing.deferredCount) {
      const scopes = standing.deferredScopes.length ? ` (scopes: ${standing.deferredScopes.join(', ')})` : '';
      out.push(`  +${standing.deferredCount} more standing decision(s) out of scope${scopes} — check before deciding in those areas (q decisions).`);
    }
  }
  return standing;
}

export function recentSection({ out }, views, decisionsFile) {
  const decisionsDir = views.recentDecisions(DECISIONS_DIR_RECENT);
  if (decisionsDir) {
    out.push('');
    out.push('--- Decisions (recent) ---');
    out.push(decisionsDir);
  } else if (decisionsFile) {
    out.push('');
    out.push('--- DECISIONS (recent) ---');
    out.push(tail(decisionsFile, DECISIONS_GIST_LINES));
    const total = lineCount(decisionsFile);
    if (total > DECISIONS_GIST_LINES) out.push(`  … (${total} lines total) — full: tail -n 40 .ai/DECISIONS.md`);
  }
}

export async function kitDecisionsSection({ out, root }) {
  try {
    const { recentKitDecisions } = await import('../../../scripts/kit-decisions.mjs');
    out.push(...recentKitDecisions(root));
  } catch {
    /* kit decision replay is best-effort */
  }
}
