import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  Cake,
  UtensilsCrossed,
  PartyPopper,
  ArrowRight,
  Clock,
  Check,
  Sparkles,
} from "lucide-react";
import { LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getSelectedPanel, isAuthenticated, useAuth } from "@/lib/auth";
import { PANEL_META, type Panel } from "@/lib/panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/select-panel")({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: SelectPanelPage,
  head: () => ({ meta: [{ title: "Choose panel — Daawat Baker's" }] }),
});

const icons: Record<Panel, typeof Cake> = {
  bakery: Cake,
  restaurant: UtensilsCrossed,
  banquet: PartyPopper,
};

function SelectPanelPage() {
  const navigate = useNavigate();
  const setPanel = useAuth((s) => s.setPanel);
  const user = useAuth((s) => s.user);
  const current = useAuth((s) => s.panel) ?? getSelectedPanel();

  const pick = (panel: Panel) => {
    setPanel(panel);
    void navigate({ to: "/" });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/14 via-background to-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-gold/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative z-10 mb-10 flex flex-col items-center text-center sm:mb-12">
        <img
          src={LOGO_SRC}
          alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
          className="mb-5 h-24 w-full max-w-[260px] object-contain sm:h-28"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-foreground">
          Who’s operating today?
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Choose your panel
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {user?.name ? `Hi ${user.name.split(" ")[0]} — ` : ""}
          Bakery, Restaurant and Banquet stay separate: menus, bills, GST and reports won’t mix.
        </p>
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-5 sm:grid-cols-3">
        {(Object.keys(PANEL_META) as Panel[]).map((id) => {
          const meta = PANEL_META[id];
          const Icon = icons[id];
          const active = current === id;
          const isOpen = meta.status === "Open";

          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-3xl border bg-card text-left shadow-[var(--shadow-soft)] transition-all duration-300",
                "hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                active ? "border-primary ring-2 ring-primary/25" : "border-border/70",
              )}
            >
              {/* Top visual band */}
              <div className="relative h-28 overflow-hidden">
                <div
                  aria-hidden
                  className={cn("absolute inset-0 bg-gradient-to-br", meta.accent)}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.35]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 30%, rgb(255 255 255 / 0.55) 0, transparent 42%), radial-gradient(circle at 80% 70%, rgb(255 255 255 / 0.25) 0, transparent 45%)",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/25 blur-2xl transition-transform duration-500 group-hover:scale-125"
                />

                <div className="relative flex h-full items-start justify-between p-5">
                  <div
                    className={cn(
                      "grid h-14 w-14 place-items-center rounded-2xl shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105",
                      meta.tint,
                      "bg-white/80",
                    )}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                      isOpen
                        ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20"
                        : "bg-gold/20 text-gold-foreground ring-1 ring-gold/30",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isOpen ? "bg-emerald-500" : "bg-gold-foreground",
                      )}
                    />
                    {meta.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xl font-semibold tracking-tight">{meta.label}</div>
                    <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gold-foreground">
                      {meta.tagline}
                    </div>
                  </div>
                  {active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Sparkles className="h-3 w-3" />
                      Last used
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{meta.description}</p>

                {/* Snapshot stats */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2.5">
                  {meta.stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-sm font-bold tracking-tight text-foreground">{stat.value}</div>
                      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <ul className="mt-4 grid grid-cols-2 gap-x-2 gap-y-1.5">
                  {meta.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                      <span className="truncate">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{meta.hours}</span>
                </div>

                <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  GSTIN · {meta.gst}
                </div>

                <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Open {meta.label.toLowerCase()} panel
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
