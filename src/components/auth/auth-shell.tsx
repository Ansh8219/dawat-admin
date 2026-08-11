import type { ReactNode } from "react";
import { LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  badge = "Admin Portal",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  badge?: string;
}) {
  return (
    <div className="grid h-dvh w-full overflow-hidden bg-background lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <aside className="relative hidden h-full min-w-0 items-center justify-center overflow-hidden px-10 lg:flex xl:px-14 2xl:px-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-1/4 h-80 w-80 rounded-full bg-gold/10 blur-3xl"
        />

        <img
          src={LOGO_SRC}
          alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
          className="relative z-10 w-full max-w-[420px] object-contain xl:max-w-[480px] 2xl:max-w-[540px]"
        />
      </aside>

      <section className="relative flex h-full min-w-0 flex-col items-center justify-center overflow-y-auto bg-muted/25 px-6 py-6 sm:px-10 lg:overflow-hidden lg:px-12 xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/6 via-transparent to-transparent"
        />

        <div className="relative z-10 mb-5 flex flex-col items-center lg:hidden">
          <img
            src={LOGO_SRC}
            alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
            className="h-20 w-full max-w-[220px] object-contain"
          />
        </div>

        <div className="relative z-10 w-full max-w-[440px]">
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-[var(--shadow-elevated)] sm:p-8">
            <div className="mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                  <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm0 2.2 6 2.25V11c0 3.9-2.5 7.3-6 8.7-3.5-1.4-6-4.8-6-8.7V6.45l6-2.25Z" />
                  <path d="M10.5 14.5 8 12l1.2-1.2 1.3 1.3 3.8-3.8L15.5 9.5l-5 5Z" />
                </svg>
                {badge}
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
              {subtitle && (
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {children}
          </div>

          {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
