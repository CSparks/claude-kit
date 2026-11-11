// cap-receipt.mjs — cap's closing output (KIT-T1040). A caller reads the LAST line of cap's output to
// learn whether anything was written, so that line is always one of:
//   filed <id> … | captured … | resolved …   — the write happened (emitReceipt)
//   cap: refused, nothing was written: <why> — a refusal, exit 1 (refuse)
//   cap: failed, nothing confirmed written: <why> — an unexpected error, exit 1 (installCrashReceipt)
// Hints (possible duplicates, ruling demands) print BEFORE the closing line, never after it.

/** Print the hint lines, then the closing receipt as the final line of stdout. */
export function emitReceipt(hintLines, receipt) {
  for (const line of hintLines) console.log(line);
  console.log(receipt);
}

/** End the run with a plain refusal line naming why nothing was written. */
export function refuse(reason) {
  console.error(`cap: refused, nothing was written: ${reason}`);
  process.exit(1);
}

/** Turn any uncaught error into a closing failure line instead of a bare stack trace. */
export function installCrashReceipt() {
  process.on('uncaughtException', (e) => {
    console.error(`cap: failed, nothing confirmed written: ${e && e.message ? e.message : e}`);
    process.exit(1);
  });
}
