/**
 * "N new orders" (SYSTEM_DESIGN.md §5.9): `order.created` events only count here, and the order
 * history shows a banner instead of refetching its page on every sale. Showing them resets it.
 */
type Listener = () => void;

let count = 0;
const listeners = new Set<Listener>();

const notify = (): void => {
  listeners.forEach((listener) => {
    listener();
  });
};

export function noteNewOrder(): void {
  count += 1;
  notify();
}

export function newOrderCount(): number {
  return count;
}

export function resetNewOrders(): void {
  if (count !== 0) {
    count = 0;
    notify();
  }
}

export function onNewOrders(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
