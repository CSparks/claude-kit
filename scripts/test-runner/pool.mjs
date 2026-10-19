// pool.mjs — run `fn(item)` over `items` with at most `workers` in flight, starting items in the
// given order (KIT-T570). Resolves with the results in completion order.

export async function runPool(items, workers, fn) {
  const results = [];
  let next = 0;
  const lane = async () => {
    while (next < items.length) results.push(await fn(items[next++]));
  };
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, lane));
  return results;
}
