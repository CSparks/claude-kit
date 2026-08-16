// Hook input: each hook reads its tool payload from stdin once per invocation.
// `payload()` is the normal entry point; it never throws (a missing/malformed
// payload yields {} so a hook fails open).

export async function readStdin() {
  const chunks = [];
  try {
    for await (const c of process.stdin) chunks.push(c);
  } catch {
    /* no stdin (e.g. SessionStart) */
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function payload() {
  try {
    return JSON.parse(await readStdin());
  } catch {
    return {};
  }
}
