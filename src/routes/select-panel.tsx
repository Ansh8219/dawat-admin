import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Cake, UtensilsCrossed, PartyPopper, ArrowRight } from "lucide-react";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/12 via-background to-background"
      />

      <div className="relative z-10 mb-10 flex flex-col items-center text-center">
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
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {user?.name ? `Hi ${user.name.split(" ")[0]} — ` : ""}
          Bakery, Restaurant and Banquet stay separate: menus, bills, GST and reports won’t mix.
        </p>
      </div>

      <div className="relative z-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {(Object.keys(PANEL_META) as Panel[]).map((id) => {
          const meta = PANEL_META[id];
          const Icon = icons[id];
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-sm transition-all",
                "hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "border-primary ring-2 ring-primary/30" : "border-border/70",
              )}
            >
              <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", meta.accent)} />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-4 text-lg font-semibold">{meta.label}</div>
                <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gold-foreground">
                  {meta.tagline}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{meta.description}</p>
                <div className="mt-4 rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                  GST · {meta.gst}
                </div>
                <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Open panel
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
