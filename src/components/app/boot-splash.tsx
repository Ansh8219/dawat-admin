import { LOGO_SRC } from "@/lib/brand";

/** Full-screen intro shown while the session, permissions and layout are being prepared. */
export function BootSplash() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background"
    >
      <img src={LOGO_SRC} alt="Daawat Baker's" className="h-20 w-auto animate-pulse" />
      <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div className="boot-bar h-full w-1/3 rounded-full bg-primary" />
      </div>
      <span className="sr-only">Loading admin panel…</span>
    </div>
  );
}
