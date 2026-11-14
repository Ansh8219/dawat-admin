import { useSyncExternalStore } from "react";

/** Count of in-flight API requests; drives the global top progress bar. */
let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** fetch() wrapper that registers the request as "in flight" until it settles. */
export async function trackedFetch(input: RequestInfo | URL, init?: RequestInit) {
  pending += 1;
  emit();
  try {
    return await fetch(input, init);
  } finally {
    pending -= 1;
    emit();
  }
}

export function usePendingRequests(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
    () => 0,
  );
}
