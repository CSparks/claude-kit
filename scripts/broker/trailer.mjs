// trailer.mjs — the `Broker-Gate:` trailer a landing commit carries (KIT-T472): the ticket
// evidence floor (KIT-T061) cites it. It names the job whose result JSON holds the logs, what
// ran, whether the full suite still owes a run, and the train it was built in.
//
// `gateTrailer(job, commands, { reused, selection, train })` → one trailer line; train = { id, size }.

const PASSED = (c) => c.exit === 0;

export function gateTrailer(job, commands, { reused = null, selection = null, train = null } = {}) {
  const ran = `${commands.filter(PASSED).length}/${commands.length} commands green`;
  const from = reused ? `, reused check ${reused.job}` : '';
  const built = train ? `, one build with ${train.size - 1} other patch(es) in ${train.id}` : '';
  const scope = selection ? '; affected gate, full suite on the cadence' : '';
  return `Broker-Gate: ${job.id} ${ran}${from}${built}${scope} (target/broker/results/${job.id}.json)`;
}
