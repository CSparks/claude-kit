// work.mjs — open work in orientation: the cross-project open count with this project's in-flight tickets and their
// trails, built-but-unticked tickets, unread @mentions, zombie `doing` tickets and the governance pointer. Each part
// is best-effort (KIT-T071, KIT-D028, KIT-T130, KIT-T028).
//
//   porcelainPath(line)                    -> the path in a `git status --porcelain` line
//   openWorkSection(ctx)
//   mentionsSection(ctx)
//   zombiesSection(ctx)
//   governsSection(ctx, { changedPaths, standing, foundational })

import { scanStaleDoingTickets } from '../../lib.mjs';
import { INFLIGHT_SHOWN, LINE_MAX, MENTIONS_SHOWN, ORIENT_DOING_STALE_MS, ORIENT_TRAIL_LINES, TRAILS_SHOWN, clip } from './common.mjs';

const MS_PER_HOUR = 3600000;
const ZOMBIE_IDS_SHOWN = 4;

export const porcelainPath = (l) => {
  const m = String(l).match(/^\s*\S{1,2}\s+(.*)$/);
  const p = (m ? m[1] : l).trim();
  const arrow = p.split(' -> ');
  return (arrow.length > 1 ? arrow[1] : p).replace(/^["']|["']$/g, '');
};

const scopeOf = (id) => (String(id).match(/^([A-Za-z][A-Za-z0-9]*)-/) || [])[1] || '';

export async function openWorkSection({ out, root }) {
  try {
    const { readIdConfig } = await import('../../../scripts/id-utils.mjs');
    const { query } = await import('../../../scripts/q-lib.mjs');
    const { key } = readIdConfig(root);
    // `all` is explicit (KIT-T255): the banner's "by scope" line is the cross-project view, not q's cwd-project default.
    const { rows: openRows } = await query('open', ['all'], { cwdRoot: root });
    if (!(openRows && openRows.length)) return;
    const inFlight = openRows.filter((r) => scopeOf(r.id) === key && (r.status === 'doing' || r.status === 'review'));
    const byScope = new Map();
    for (const r of openRows) { const s = scopeOf(r.id); byScope.set(s, (byScope.get(s) || 0) + 1); }
    out.push('');
    out.push('--- Open work ---');
    out.push('  by scope: ' + [...byScope.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([s, n]) => `${s}:${n}`).join('  '));
    if (inFlight.length) {
      out.push(`  in-flight (${key}):`);
      const shownFlight = [...inFlight.filter((x) => x.status === 'doing'), ...inFlight.filter((x) => x.status !== 'doing')].slice(0, INFLIGHT_SHOWN);
      for (const r of shownFlight) out.push(`    [${r.status}] ${r.id} — ${clip(r.title || '', LINE_MAX)}`);
      if (inFlight.length > shownFlight.length) out.push(`    +${inFlight.length - shownFlight.length} more in-flight — q open`);
      // Trail-on-action (KIT-D028): a `doing` ticket resumes with the governing context it came from, summaries only.
      const { renderTrail } = await import('../../../scripts/provenance.mjs');
      for (const r of inFlight.filter((x) => x.status === 'doing').slice(0, TRAILS_SHOWN)) {
        const { rows: trailRows } = await query('trail', [r.id], { cwdRoot: root, assumeFresh: true });
        out.push(`    trail ${r.id}:`);
        out.push(...renderTrail(trailRows, { limit: ORIENT_TRAIL_LINES, indent: '      ' }));
      }
    }
    const { builtButUnticked } = await import('../../../scripts/landed.mjs');
    const built = builtButUnticked(root);
    for (const r of built.slice(0, INFLIGHT_SHOWN)) out.push(`    [${r.status}] ${r.id} built-but-unticked (${r.count} landed commits) — ${clip(r.title, LINE_MAX)}`);
    if (built.length > INFLIGHT_SHOWN) out.push(`    +${built.length - INFLIGHT_SHOWN} more built-but-unticked — q show <id> prints LANDED COMMITS`);
    out.push(`  drill-in: q open | q trail <id> | q fts <terms>`);
  } catch {
    /* cache + fallback both unavailable — orientation proceeds without the open-work view */
  }
}

// Unread @mentions for the acting agent: durable comments a tabula-rasa session must pick up (KIT-T130).
export async function mentionsSection({ out, root }) {
  try {
    const { resolveAgent } = await import('../../../scripts/comments.mjs');
    const { query } = await import('../../../scripts/q-lib.mjs');
    const agent = resolveAgent();
    const { rows: mentionRows } = await query('mentions', [agent], { cwdRoot: root });
    const unread = (mentionRows || []).filter((r) => r.state === 'unread');
    if (unread.length) {
      out.push('');
      out.push(`--- UNREAD @${agent} mentions (${unread.length}) — comments addressed to you; ack to clear ---`);
      for (const r of unread.slice(0, MENTIONS_SHOWN)) out.push(`  ${r.ref} [${r.ts}] ${r.from}: ${clip(String(r.text || ''), LINE_MAX)}`);
      if (unread.length > MENTIONS_SHOWN) out.push(`  +${unread.length - MENTIONS_SHOWN} more — q mentions ${agent}`);
      out.push(`  ack once read: t ack <id>#<n> --agent ${agent}`);
    }
  } catch {
    /* mentions surfacing is fail-open — never break orientation */
  }
}

export function zombiesSection({ out, root }) {
  try {
    const sd = scanStaleDoingTickets(root, ORIENT_DOING_STALE_MS);
    if (sd.count) {
      const oldestH = Math.round(sd.oldestMs / MS_PER_HOUR);
      const ids = sd.ids.slice(0, ZOMBIE_IDS_SHOWN).join(', ') + (sd.ids.length > ZOMBIE_IDS_SHOWN ? ` +${sd.ids.length - ZOMBIE_IDS_SHOWN} more` : '');
      out.push('');
      out.push(`!! ZOMBIE DOING (${sd.count}): ${ids} — stuck \`doing\` >${oldestH}h with no update.`);
      out.push(`   Reconcile: t status <id> todo (if bailed) or review (if done).`);
    }
  } catch {
    /* stale-doing scan is fail-open — never block orientation */
  }
}

// GOVERNS: a pointer with the count only; the full list is `q governing <path>` (KIT-T071).
export async function governsSection({ out, root }, { changedPaths, standing, foundational }) {
  try {
    const filePaths = changedPaths.filter((p) => /\.[a-z0-9]+$/i.test(p));
    if (!filePaths.length) return;
    const { query } = await import('../../../scripts/q-lib.mjs');
    const { rows: govRows } = await query('governing', filePaths, { root, cwdRoot: root });
    const already = new Set([...(standing && standing.shownIds ? standing.shownIds : []), ...foundational.map((m) => m.id).filter(Boolean)]);
    const fresh = (govRows || []).filter((r) => !already.has(r.id));
    if (fresh.length) {
      out.push('');
      out.push(`--- GOVERNS what you're touching: ${fresh.length} item(s) — q governing <path> to inspect ---`);
    }
  } catch {
    /* governing query unavailable — orientation proceeds without the file-governance view */
  }
}
