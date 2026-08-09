import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  Package,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";
import { LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const FEATURES = [
  {
    title: "Orders & Billing",
    description: "Manage dine-in, takeaway, delivery and online orders.",
    icon: Receipt,
    tone: "bg-primary/10 text-primary",
  },
  {
    title: "Inventory Control",
    description: "Track stock in real-time and never run out of essentials.",
    icon: Package,
    tone: "bg-amber-500/15 text-amber-600",
  },
  {
    title: "Business Insights",
    description: "Get real-time reports and grow your profits smarter.",
    icon: BarChart3,
    tone: "bg-violet-500/15 text-violet-600",
  },
  {
    title: "Staff & Operations",
    description: "Manage your team and daily operations with ease.",
    icon: Users,
    tone: "bg-emerald-500/15 text-emerald-600",
  },
] as const;

const STATS = [
  { label: "Businesses Connected", value: "3", icon: Building2, tone: "bg-primary/10 text-primary" },
  {
    label: "Orders Processed",
    value: "12.8K+",
    icon: ShoppingBag,
    tone: "bg-amber-500/15 text-amber-600",
  },
  {
    label: "Happy Customers",
    value: "2.5K+",
    icon: UsersRound,
    tone: "bg-violet-500/15 text-violet-600",
  },
  { label: "Business Growth", value: "98%", icon: TrendingUp, tone: "bg-emerald-500/15 text-emerald-600" },
] as const;

const FOOD_IMAGES = [
  {
    src: "/auth/croissant.jpg",
    alt: "Croissant",
    className: "left-[3%] bottom-1 h-32 w-44 rotate-[-8deg] 2xl:h-36 2xl:w-48",
  },
  {
    src: "/auth/cupcake.jpg",
    alt: "Cupcake",
    className: "left-[27%] bottom-3 h-40 w-32 rotate-[4deg] 2xl:h-44 2xl:w-36",
  },
  {
    src: "/auth/donut.jpg",
    alt: "Donut",
    className: "left-[50%] bottom-1 h-32 w-44 rotate-[-3deg] 2xl:h-36 2xl:w-48",
  },
  {
    src: "/auth/wheat.jpg",
    alt: "Wheat",
    className: "right-[3%] bottom-4 h-32 w-44 rotate-[6deg] 2xl:h-36 2xl:w-52",
  },
] as const;

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
      <aside className="relative hidden h-full min-w-0 flex-col overflow-hidden px-10 pb-40 pt-8 lg:flex xl:px-14 2xl:px-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-1/4 h-80 w-80 rounded-full bg-gold/10 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src={LOGO_SRC}
            alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
            className="h-14 w-auto max-w-[200px] object-contain xl:h-16 xl:max-w-[220px]"
          />
          <div className="hidden h-9 w-px bg-border sm:block" />
          <div className="hidden sm:block">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
              Owner Console
            </div>
            <div className="text-[10px] text-muted-foreground">Admin Portal</div>
          </div>
        </div>

        <div className="relative z-10 mt-8 w-full max-w-3xl">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            One connected workspace
          </p>
          <h1 className="mt-3 font-display text-[2.35rem] leading-[1.15] tracking-tight text-foreground xl:text-[2.75rem] 2xl:text-[3.1rem]">
            From your kitchen to your customers,{" "}
            <span className="relative inline-block text-primary">
              all in one place.
              <svg
                aria-hidden
                className="absolute -bottom-0.5 left-0 w-full text-primary"
                viewBox="0 0 200 10"
                fill="none"
              >
                <path
                  d="M2 7c40-5 80-7 120-3s56 3 76 1"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Manage orders, inventory, billing, staff, bookings and more — from a single powerful
            dashboard.
          </p>
        </div>

        <div className="relative z-10 mt-6 grid w-full max-w-3xl grid-cols-2 gap-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-[var(--shadow-soft)] backdrop-blur-sm"
            >
              <div className={`mb-2.5 grid h-9 w-9 place-items-center rounded-xl ${feature.tone}`}>
                <feature.icon className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div className="text-sm font-semibold text-foreground">{feature.title}</div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-5 flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-3.5">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex min-w-0 items-center gap-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${stat.tone}`}>
                <stat.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-foreground">{stat.value}</div>
                <div className="truncate text-[10px] font-medium text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40">
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/85 to-transparent" />
          {FOOD_IMAGES.map((img) => (
            <img
              key={img.alt}
              src={img.src}
              alt=""
              className={`absolute rounded-2xl object-cover shadow-[var(--shadow-elevated)] ring-1 ring-black/5 ${img.className}`}
            />
          ))}
        </div>
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
            className="mb-2 h-16 w-full max-w-[180px] object-contain"
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Owner Console
          </p>
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
