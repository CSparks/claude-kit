// q-fallback.mjs — the markdown-scan fallback behind every canned query. With no DB (or no
// SQLite engine), each verb degrades to an in-memory db-parse scan so an agent/hook still
// gets answers: the cache is an accelerator, never a hard dependency (KIT-T031).
//
// Every ordering/edge/predicate it uses comes from q-model.mjs — the SAME module the
// cache-backed SQL path imports — so cache-vs-scan parity (KIT-T026) is structural.

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { collectItems } from './db-parse.mjs';
import { compareIds } from './id-utils.mjs';
import { mentionsForAgent, readReceipts } from './comments.mjs';
import { governing, drift } from './q-governing.mjs';
import { parseInboxArgs, inboxRows, CONFIRMATION_DAYS } from './q-inbox.mjs';
import { orphanRows } from './provenance.mjs';
import { recentFallback } from './q-recent.mjs';
import {
  OPEN, FTS_LIMIT, MIN_TERM_LEN, ALNUM_TERM, SUMMARY_CLIP,
  parseSimilar, parseFts, requireStore, requireScope, defaultScope, formatId, compareOpen, isSuperseded,
  edgesOf, clip, walkAncestry,
} from './q-model.mjs';

const statMs = (p) => { try { return statSync(p).mtimeMs; } catch { return null; } };

export function fallback(cmd, args, root) {
  const items = collectItems(root);
  const byId = new Map(items.map((i) => [i.id, i]));
  switch (cmd) {
    case 'open': {
      const scope = args[0];
      return items.filter((i) => OPEN.includes(i.status) && !i.archived && !isSuperseded(i) && (!scope || i.scope === scope))
        .map((i) => ({ id: i.id, type: i.type, status: i.status, priority: i.priority, title: i.title }))
        .sort(compareOpen);
    }
    case 'children':
      return items.filter((i) => i.parent === args[0]).map((i) => ({ id: i.id, type: i.type, status: i.status, title: i.title }));
    case 'backlinks': {
      const id = args[0];
      const out = [];
      for (const i of items) for (const [rel, to] of edgesOf(i)) {
        if (to === id) out.push({ id: i.id, type: i.type, status: i.status, rel, title: i.title });
      }
      return out.sort((a, b) => a.rel.localeCompare(b.rel) || compareIds(a.id, b.id));
    }
    case 'by-commit': {
      const sha = args[0];
      const out = [];
      for (const i of items) for (const [rel, to] of edgesOf(i)) {
        if ((rel === 'caused_by' || rel === 'fixed_by') && to === sha) {
          out.push({ id: i.id, type: i.type, status: i.status, rel, title: i.title });
        }
      }
      return out.sort((a, b) => a.rel.localeCompare(b.rel) || compareIds(a.id, b.id));
    }
    case 'doc-trail':
      return (byId.get(args[0])?.history || []).slice().sort((a, b) => String(b.ts).localeCompare(a.ts));
    case 'recent':
      return recentFallback(items, args);
    case 'trail':
      return walkAncestry(
        args[0],
        (x) => { const it = byId.get(x); return it ? edgesOf(it) : []; },
        (x) => byId.get(x),
      );
    case 'orphans':
      return orphanRows(items, (id) => { const it = byId.get(id); return it ? edgesOf(it) : []; }, args[0]);
    case 'fts': {
      // Same `--scope` split as the cache path (KIT-T174); the scan needs no FTS escaping
      // because it never builds a MATCH expression — it substring-matches the raw terms.
      const { scope, query } = parseFts(args.join(' '), root);
      const needle = query.toLowerCase();
      return items.filter((i) => (!scope || i.scope === scope) && (`${i.title} ${i.body}`).toLowerCase().includes(needle))
        .slice(0, FTS_LIMIT).map((i) => ({ id: i.id, type: i.type, status: i.status, title: i.title }));
    }
    case 'rundown': {
      const m = new Map();
      for (const i of items) {
        if (i.archived) continue;
        const r = m.get(i.scope) || { scope: i.scope, open: 0, doing: 0, review: 0 };
        if (OPEN.includes(i.status)) r.open++;
        if (i.status === 'doing') r.doing++;
        if (i.status === 'review') r.review++;
        m.set(i.scope, r);
      }
      return [...m.values()].sort((a, b) => a.scope.localeCompare(b.scope));
    }
    // `scope` mirrors the cache path's WHERE (KIT-T125). The scan is already confined to one
    // root, so it is a no-op in practice — but parity is structural here, not incidental.
    case 'regressions':
      return items.filter((i) => i.store === 'tickets' && (!args[0] || i.scope === args[0]))
        .map((i) => ({
          id: i.id, title: i.title,
          regressed_from: i.regressedFrom || null,
          causing_commit: i.causingCommit || null,
          fixed_commit: i.fixedCommit || null,
        }))
        .sort((a, b) => compareIds(a.id, b.id));
    case 'supersedes':
      return items.filter((i) => i.store === 'tickets' && (!args[0] || i.scope === args[0]))
        .map((i) => ({ id: i.id, status: i.status, title: i.title, supersedes: i.supersedes || null }))
        .sort((a, b) => compareIds(a.id, b.id));
    case 'similar': {
      // Mirror the cache's FTS OR-match with a term-overlap scan: candidates sharing the most
      // proposal terms first (suggest-only). Excludes archived + already-superseded items, and
      // confines to the target store (KIT-T025) — same `--store` parse as the cache path.
      const { store, query } = parseSimilar(args.join(' '));
      const wanted = new Set((query.toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN));
      if (!wanted.size) return [];
      return items
        .filter((i) => i.store === store && !i.archived && i.status !== 'superseded')
        .map((i) => {
          const hay = new Set((`${i.title} ${i.body}`.toLowerCase().match(ALNUM_TERM) || []));
          let overlap = 0;
          for (const t of wanted) if (hay.has(t)) overlap++;
          return { row: { id: i.id, type: i.type, status: i.status, title: i.title }, overlap };
        })
        .filter((c) => c.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap || compareIds(a.row.id, b.row.id))
        .slice(0, FTS_LIMIT)
        .map((c) => c.row);
    }
    // Inbox (KIT-T238) — the scan already carries every cap's body and file path, so the
    // shaping/filtering is the SAME module the cache path uses; only the source differs.
    case 'inbox':
    case 'confirmations': {
      const parsed = parseInboxArgs(args, root);
      const opts = cmd === 'confirmations' ? { ...parsed, olderThanDays: CONFIRMATION_DAYS } : parsed;
      const aiDir = join(root, '.ai');
      return inboxRows(
        items.filter((i) => i.store === 'inbox' && !i.archived)
          .map((i) => ({ ...i, mtimeMs: statMs(join(aiDir, i.file)) })),
        { ...opts, aiDirFor: () => aiDir },
      );
    }
    case 'next-id': {
      const scope = requireScope(args[0]);
      const store = requireStore(args[1]);
      // The scan sees ONE project — this root's stores. Answering for a DIFFERENT scope means
      // counting from zero over files it never opened, which mints `<SCOPE>-D001` on top of a
      // store that already holds a dozen decisions. Refuse instead of allocating blind.
      const localScope = defaultScope(root);
      if (scope !== localScope) {
        throw new Error(
          `next-id: no cache, so this answer would come from scanning ${root}` +
          `${localScope ? ` (scope ${localScope})` : ' (not an adopted project)'} — which cannot see scope ${scope}. ` +
          `Re-run with --root <that project's directory>, or hydrate the cache.`);
      }
      const max = items.filter((i) => i.scope === scope && i.store === store && i.num).reduce((a, i) => Math.max(a, i.num), 0);
      return [{ id: formatId(root, scope, store, max + 1), scope, store, num: max + 1 }];
    }
    // File-scoped governance (KIT-T049) — scan-only by nature: the governing fields
    // (`files`/`scope`/`paths`) and the FTS body aren't in the SQLite schema, so collectItems
    // IS the source whether or not an engine exists. `root` is the repo whose tree drift checks.
    case 'governing':
      return governing(items, args);
    case 'drift':
      return drift(items, (t) => existsSync(join(root, t)));
    // @mention inbox (KIT-T130): comments across the project mentioning <agent>, each with
    // read state (acked?). Scan-only by nature — comment bodies + Notes spills + the ack
    // sidecar aren't in the SQLite schema, so the markdown scan IS the source (like governing).
    case 'mentions': {
      const agent = args[0];
      if (!agent) throw new Error('mentions needs an <agent>: q mentions <agent>');
      const receipts = readReceipts(root);
      return mentionsForAgent(items, receipts, agent)
        .map((m) => ({ id: m.id, ref: m.ref, state: m.acked ? 'read' : 'unread', ts: m.ts, from: `@${m.author}`, text: clip(m.text, SUMMARY_CLIP) }));
    }
    default:
      throw new Error(`'${cmd}' has no markdown fallback (needs SQLite). sql/integrity require the cache.`);
  }
}
