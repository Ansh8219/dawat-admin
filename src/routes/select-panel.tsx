import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Cake,
  ChevronDown,
  CloudSun,
  FileText,
  Headset,
  Lightbulb,
  Loader2,
  MoonStar,
  PartyPopper,
  Sun,
  UtensilsCrossed,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listBusinesses } from "@/lib/api/businesses";
import type { Business } from "@/lib/api/types";
import { ApiError } from "@/lib/api/types";
import { LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { canCheckPersistedAuth, getSelectedPanel, isAuthenticated, useAuth } from "@/lib/auth";
import { PANEL_META, businessTypeToPanel, type Panel } from "@/lib/panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/select-panel")({
  beforeLoad: () => {
    if (!canCheckPersistedAuth()) return;
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
    ring: "hover:border-primary/40",
  },
  amber: {
    button: "bg-amber-500 text-white hover:bg-amber-600",
    iconWrap: "bg-amber-500/15 text-amber-600",
    ring: "hover:border-amber-400/50",
  },
  violet: {
    button: "bg-violet-600 text-white hover:bg-violet-700",
    iconWrap: "bg-violet-500/15 text-violet-600",
    ring: "hover:border-violet-400/50",
  },
} as const;

function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return { text: "Good Morning", Icon: Sun };
  if (h < 17) return { text: "Good Afternoon", Icon: CloudSun };
  return { text: "Good Evening", Icon: MoonStar };
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
  const selectBusiness = useAuth((s) => s.selectBusiness);
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);
  const getAccessToken = useAuth((s) => s.getAccessToken);
  const refreshSession = useAuth((s) => s.refreshSession);
  const current = useAuth((s) => s.business?.publicId ?? null);
  const currentPanel = useAuth((s) => s.panel) ?? getSelectedPanel();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const greeting = greetingForNow();
  const GreetingIcon = greeting.Icon;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setError("Please sign in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const fetchList = (token: string) => listBusinesses(token);

      try {
        let data: Business[];
        try {
          data = await fetchList(accessToken);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            const refreshed = await refreshSession();
            const nextToken = useAuth.getState().tokens?.access;
            if (!refreshed || !nextToken) {
              logout();
              void navigate({ to: "/login" });
              return;
            }
            data = await fetchList(nextToken);
          } else {
            throw err;
          }
        }
        if (!cancelled) setBusinesses(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "staff_access_denied") {
          setError("This account does not have staff access.");
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Unable to load businesses.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, logout, navigate, refreshSession]);

  const pick = (biz: Business) => {
    const result = selectBusiness(biz);
    if (!result.ok) {
      setError(result.error);
      return;
    }
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
        <header className="flex items-center justify-between gap-4">
          <img
            src={LOGO_SRC}
            alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
            className="h-14 w-auto max-w-[200px] object-contain sm:h-16"
          />

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
        </header>

        <section className="mt-4 mb-8 text-center sm:mt-5 sm:mb-10">
          <p className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground sm:text-[15px]">
            <GreetingIcon className="h-4 w-4 text-primary" strokeWidth={2.25} />
            <span>
              {greeting.text}, <span className="font-medium text-foreground">{firstName}</span>!
            </span>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-[1.85rem]">
            Select Business to Manage
          </h1>
        </section>

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading businesses…</p>
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        ) : businesses.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
            No active businesses available.
          </div>
        ) : (
          <div className="grid flex-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {businesses.map((biz) => {
              const panel = businessTypeToPanel(biz.type);
              const meta = panel ? PANEL_META[panel] : null;
              const Icon = panel ? panelIcons[panel] : Cake;
              const theme = themeStyles[meta?.theme ?? "primary"];
              const selected =
                current === biz.public_id || (!current && currentPanel === panel);
              const imageSrc = biz.image || meta?.image || "/panels/restaurant.jpg";
              const imageAlt = meta?.imageAlt ?? biz.name;

              return (
                <article
                  key={biz.public_id}
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
                        src={imageSrc}
                        alt={imageAlt}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="eager"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
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
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{biz.name}</h2>
                    {meta?.tagline ? (
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                        {meta.tagline}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => pick(biz)}
                      className={cn(
                        "mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors",
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
        )}

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
