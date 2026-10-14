// suite-shard.mjs — the full suite in rotating partitions (KIT-T482 item 6). A forced suite run
// holds the writer for its whole length (a stiletto workspace suite is ~3,200 s), so with
// `suite_partitions: N` each run executes one partition: a `cargo nextest run` gets
// `--partition count:k/N`, and the other suite commands take turns, one partition each. N consecutive
// runs cover the whole suite.
//
// `shardCommands(suite, k, n)` → the commands for partition k of n (1-based).
// `nextShard(k, n)` → the partition after k.

const NEXTEST = /^cargo\s+nextest\s+run\b/;

export function shardCommands(suite, k, n) {
  if (n <= 1) return suite.slice();
  let turn = 0;
  return suite.flatMap((cmd) => {
    if (NEXTEST.test(cmd.trim())) return [`${cmd.trim()} --partition count:${k}/${n}`];
    return turn++ % n === (k - 1) % n ? [cmd] : [];
  });
}

export const nextShard = (k, n) => (n <= 1 ? 1 : (k % n) + 1);
