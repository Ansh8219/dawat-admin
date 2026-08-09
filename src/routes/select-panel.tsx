import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  Armchair,
  ArrowRight,
  Bell,
  Cake,
  Calendar,
  CalendarCheck,
  ChevronDown,
  Clock3,
  CloudSun,
  FileText,
  Headset,
  IndianRupee,
  Lightbulb,
  MoonStar,
  PartyPopper,
  ShoppingBag,
  Sun,
  UtensilsCrossed,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getSelectedPanel, isAuthenticated, useAuth } from "@/lib/auth";
import { PANEL_META, PANEL_ORDER, type Panel, type PanelStat } from "@/lib/panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/select-panel")({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: SelectPanelPage,
  head: () => ({ meta: [{ title: "Select business — Daawat Baker's" }] }),
});

const panelIcons: Record<Panel, typeof Cake> = {
  bakery: Cake,
  restaurant: UtensilsCrossed,
  banquet: PartyPopper,
};

const themeStyles = {
  primary: {
    button: "bg-primary text-primary-foreground hover:bg-primary/90",
    iconWrap: "bg-primary/10 text-primary",
    metricIcon: "bg-primary/10 text-primary",
    alert: "bg-primary/10 text-primary",
    ring: "hover:border-primary/40",
  },
  amber: {
    button: "bg-amber-500 text-white hover:bg-amber-600",
    iconWrap: "bg-amber-500/15 text-amber-600",
    metricIcon: "bg-amber-500/15 text-amber-600",
    alert: "bg-amber-500/15 text-amber-700",
    ring: "hover:border-amber-400/50",
  },
  violet: {
    button: "bg-violet-600 text-white hover:bg-violet-700",
    iconWrap: "bg-violet-500/15 text-violet-600",
    metricIcon: "bg-violet-500/15 text-violet-600",
    alert: "bg-violet-500/15 text-violet-700",
    ring: "hover:border-violet-400/50",
  },
} as const;

const hintToneClass = {
  up: "text-emerald-600",
  warn: "text-amber-600",
  info: "text-sky-600",
  neutral: "text-muted-foreground",
} as const;

function StatIcon({ icon }: { icon: PanelStat["icon"] }) {
  const props = { className: "h-3.5 w-3.5", strokeWidth: 2.25 as const };
  switch (icon) {
    case "sales":
    case "revenue":
      return <IndianRupee {...props} />;
    case "orders":
      return <ShoppingBag {...props} />;
    case "tables":
      return <Armchair {...props} />;
    case "pending":
      return <Cake {...props} />;
    case "events":
      return <Calendar {...props} />;
    case "bookings":
      return <CalendarCheck {...props} />;
  }
}

function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return { text: "Good Morning", Icon: Sun };
  if (h < 17) return { text: "Good Afternoon", Icon: CloudSun };
  return { text: "Good Evening", Icon: MoonStar };
}

function formatLastLogin(date = new Date()) {
  return `Today, ${date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
}

const FOOTER_TIPS = [
  {
    title: "Business Tip",
    body: "Keep your menu & inventory updated to attract more customers.",
    icon: Lightbulb,
    tone: "bg-amber-500/15 text-amber-600",
  },
  {
    title: "Daily Reports",
    body: "View detailed sales, orders and payments reports.",
    icon: FileText,
    tone: "bg-sky-500/15 text-sky-600",
  },
  {
    title: "Stay Updated",
    body: "Enable notifications to never miss important updates.",
    icon: Bell,
    tone: "bg-primary/10 text-primary",
  },
  {
    title: "Need Help?",
    body: "Contact support for any assistance you need.",
    icon: Headset,
    tone: "bg-emerald-500/15 text-emerald-600",
  },
] as const;

function SelectPanelPage() {
  const navigate = useNavigate();
  const setPanel = useAuth((s) => s.setPanel);
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);
  const current = useAuth((s) => s.panel) ?? getSelectedPanel();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const greeting = greetingForNow();
  const GreetingIcon = greeting.Icon;

  const pick = (panel: Panel) => {
    setPanel(panel);
    void navigate({ to: "/" });
  };

  const initials = (user?.name ?? "A")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative min-h-screen bg-background pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 8% 20%, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent 42%),
            radial-gradient(ellipse at 92% 12%, color-mix(in oklab, var(--color-gold) 12%, transparent), transparent 40%),
            radial-gradient(ellipse at 50% 100%, color-mix(in oklab, var(--color-primary) 7%, transparent), transparent 50%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6">
        {/* Top nav */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={LOGO_SRC}
              alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
              className="h-12 w-auto max-w-[170px] object-contain sm:h-14"
            />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <div className="hidden sm:block">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
                Business Suite
              </div>
              <div className="text-[10px] text-muted-foreground">Owner Console</div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 shadow-[var(--shadow-soft)] transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-sm font-medium text-foreground sm:inline">
                    {user?.name ?? "Admin"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    void navigate({ to: "/login" });
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="flex items-center gap-1.5 whitespace-nowrap pr-0.5 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" />
              Last login:{" "}
              <span className="font-medium text-foreground/70">{formatLastLogin()}</span>
            </p>
          </div>
        </header>

        {/* Greeting */}
        <section className="mt-10 mb-8 text-center sm:mt-12 sm:mb-10">
          <p className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground sm:text-[15px]">
            <GreetingIcon className="h-4 w-4 text-primary" strokeWidth={2.25} />
            <span>
              {greeting.text}, <span className="font-medium text-foreground">{firstName}</span>!
            </span>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-[1.85rem]">
            Select Business to Manage
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Each business has separate menu, bills, inventory, GST and reports.
          </p>
        </section>

        {/* Cards */}
        <div className="grid flex-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PANEL_ORDER.map((id) => {
            const meta = PANEL_META[id];
            const Icon = panelIcons[id];
            const theme = themeStyles[meta.theme];
            const selected = current === id;

            return (
              <article
                key={id}
                className={cn(
                  "group relative flex flex-col rounded-[1.35rem] border bg-card shadow-[var(--shadow-soft)] transition-all duration-300",
                  "hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]",
                  theme.ring,
                  selected ? "border-primary/55 ring-2 ring-primary/20" : "border-border/80",
                )}
              >
                <div className="relative">
                  <div className="relative h-40 overflow-hidden rounded-t-[1.3rem] bg-muted sm:h-44">
                    <img
                      src={meta.image}
                      alt={meta.imageAlt}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="eager"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
                    {meta.active && (
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                        Active
                      </span>
                    )}
                  </div>

                  <div
                    className={cn(
                      "absolute -bottom-6 right-4 z-20 grid h-12 w-12 place-items-center rounded-full border-[3px] border-white bg-white shadow-md",
                      theme.iconWrap,
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                </div>

                <div className="flex flex-1 flex-col rounded-b-[1.3rem] px-5 pb-5 pt-8">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{meta.label}</h2>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">{meta.tagline}</p>

                  <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-border/70 bg-muted/30 p-2.5">
                    {meta.stats.map((stat) => (
                      <div key={stat.label} className="min-w-0 px-0.5 text-center">
                        <div
                          className={cn(
                            "mx-auto mb-1.5 grid h-7 w-7 place-items-center rounded-full",
                            theme.metricIcon,
                          )}
                        >
                          <StatIcon icon={stat.icon} />
                        </div>
                        <div className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                          {stat.label}
                        </div>
                        <div className="mt-1 truncate text-[13px] font-bold tracking-tight text-foreground">
                          {stat.value}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 truncate text-[10px] font-semibold",
                            hintToneClass[stat.hintTone],
                          )}
                        >
                          {stat.hint}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium text-muted-foreground">GST No.</div>
                      <div className="truncate font-mono text-[11px] text-foreground/90">
                        {meta.gst}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                        theme.alert,
                      )}
                    >
                      {meta.alert}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => pick(id)}
                    className={cn(
                      "mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      theme.button,
                    )}
                  >
                    Open Dashboard
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="mt-8 grid gap-2 rounded-2xl border border-border/80 bg-card p-3 shadow-[var(--shadow-soft)] sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_TIPS.map((tip) => (
            <div key={tip.title} className="flex items-start gap-3 rounded-xl px-2 py-2">
              <span
                className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", tip.tone)}
              >
                <tip.icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{tip.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{tip.body}</p>
              </div>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}
