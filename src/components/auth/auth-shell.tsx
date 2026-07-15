import type { ReactNode } from "react";
import { LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={LOGO_SRC}
            alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
            className="mb-4 h-24 w-full max-w-[280px] object-contain sm:h-28"
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-foreground">
            Admin Panel
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
