// wait-guard.mjs — keeps a wait on a pending job from ever exiting with a failing code (KIT-T851).
// A harness that backgrounds the call strips its console: the next write raises EPIPE, and a signal or a
// throw inside the poll loop would exit 1, which every caller reads as a red result. While armed, each of
// those ends the wait through `finishPending` (exit 2, STILL RUNNING); once disarmed a throw is a real error.

const SIGNALS = ['SIGTERM', 'SIGHUP', 'SIGINT', 'SIGBREAK'];
const FAILURE_EXIT = 1;

/** Arm the guard; returns `disarm`, called once a final result is in hand. */
export function armWaitGuard(finishPending, { stdout = process.stdout, stderr = process.stderr, proc = process } = {}) {
  let armed = true;
  const swallow = () => {};
  stdout.on('error', swallow);
  stderr.on('error', swallow);
  const end = (why) => {
    if (!armed) return;
    armed = false;
    try { stderr.write(`wait: ${why}\n`); } catch { /* console already stripped */ }
    finishPending();
  };
  proc.on('uncaughtException', (err) => {
    if (!armed) {
      try { stderr.write(`${err?.stack || err}\n`); } catch { /* console already stripped */ }
      proc.exit(FAILURE_EXIT);
    }
    end(`${err?.stack || err}`);
  });
  for (const sig of SIGNALS) proc.on(sig, () => end(`received ${sig} while the job is still running`));
  return () => { armed = false; };
}
