// q-print.mjs — row output shared by the q CLI and its thin client (imports nothing).

/** Print q rows: JSON, `(no results)`, a keyed object of lists, or one compact line per row. */
export function printRows(rows, json) {
  if (json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return; }
  if (!rows || (Array.isArray(rows) && !rows.length)) { process.stdout.write('(no results)\n'); return; }
  if (typeof rows === 'object' && !Array.isArray(rows)) {
    for (const [k, v] of Object.entries(rows)) {
      process.stdout.write(`${k}: ${Array.isArray(v) ? v.length : v}\n`);
      if (Array.isArray(v)) for (const r of v) process.stdout.write('  ' + compact(r) + '\n');
    }
    return;
  }
  if (onlyNotes(rows)) process.stdout.write('(no results)\n');
  for (const r of rows) process.stdout.write(compact(r) + '\n');
}

// Rows with no location are notes (a "NOT searched" caution); a list of only notes found nothing.
const onlyNotes = (rows) => rows.every((r) => r && typeof r === 'object' && r.loc === '' && !String(r.text).startsWith('(no results'));
const compact = (r) =>
  typeof r === 'string' ? r : Object.values(r).map((v) => (v === null ? '' : String(v))).join('  ');
