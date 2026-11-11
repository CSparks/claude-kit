// slot-order.mjs — the order builds take cores in (KIT-D105, KIT-T1044). Arrival order across the whole machine, with one
// amendment inside a checkout: a ticket marked `priority` (its daemon holds a submodule tree another lane of the same
// checkout is waiting for) goes ahead of that checkout's earlier tickets, so the tree is freed sooner. It never passes
// a ticket of another checkout, and a ticket without a `group` is never moved.
//
//   orderTickets([{ name, group?, priority? }]) -> names; `name` sorts by arrival, so the input is taken in any order

export function orderTickets(entries) {
  const queue = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const ticket of queue.filter((t) => t.priority && t.group)) {
    const from = queue.indexOf(ticket);
    const first = queue.findIndex((t) => t.group === ticket.group);
    if (first >= 0 && first < from) {
      queue.splice(from, 1);
      queue.splice(first, 0, ticket);
    }
  }
  return queue.map((t) => t.name);
}
