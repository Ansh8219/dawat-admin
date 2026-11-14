import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePendingRequests } from "@/lib/api/activity";

type Phase = "idle" | "loading" | "finishing";

/**
 * Thin top progress bar for route changes and API calls. It only appears after a short delay,
 * so quick requests (and background polling) don't make it flicker.
 */
export function GlobalProgress() {
  const pending = usePendingRequests();
  const routing = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  const busy = pending > 0 || routing;
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (busy) {
      const t = window.setTimeout(() => setPhase("loading"), 250);
      return () => window.clearTimeout(t);
    }
    // Became idle: complete the bar only if it was actually shown.
    let t2: number | undefined;
    setPhase((p) => {
      if (p === "loading") {
        t2 = window.setTimeout(() => setPhase("idle"), 350);
        return "finishing";
      }
      return p;
    });
    return () => window.clearTimeout(t2);
  }, [busy]);

  if (phase === "idle") return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-busy={phase === "loading"}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden"
    >
      <div
        className={
          phase === "loading"
            ? "top-bar-loading h-full rounded-r-full bg-primary shadow-[0_0_8px_var(--primary)]"
            : "top-bar-finish h-full rounded-r-full bg-primary"
        }
      />
    </div>
  );
}
