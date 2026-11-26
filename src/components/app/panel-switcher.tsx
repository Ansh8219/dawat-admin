import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Check, ChevronDown, LayoutGrid } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  actionCount,
  pendingParts,
  unreadFor,
  usePendingSummary,
  useUnreadCounts,
} from "@/hooks/use-cross-business";
import { useBusinessScope } from "@/lib/access";
import type { Business, PendingSummaryBusiness } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { BUSINESS_TAG, isBusinessType, useBusinessesList } from "@/lib/business-nav";
import { cn } from "@/lib/utils";

type Row = {
  biz: Business;
  current: boolean;
  pending: PendingSummaryBusiness | undefined;
  work: number;
  unread: number;
};

function CountBadge({ value, muted }: { value: number; muted?: boolean }) {
  if (value <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none",
        muted ? "bg-muted text-muted-foreground" : "bg-destructive text-destructive-foreground",
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/**
 * Header panel switcher. Shows every business the admin can open with its waiting work
 * (new orders, counter payments, hall enquiries) and unread notifications, so activity on
 * another panel is visible at all times.
 */
export function PanelSwitcher({ label, gst }: { label: string; gst: string }) {
  const navigate = useNavigate();
  const scope = useBusinessScope();
  const currentId = useAuth((s) => s.business?.publicId ?? null);
  const currentType = useAuth((s) => s.business?.type ?? null);
  const { data: businesses } = useBusinessesList(scope.canSwitchPanel);
  const { data: summary } = usePendingSummary();
  const { data: unread } = useUnreadCounts();

  const rows: Row[] = scope.panelChoices(businesses ?? []).map((biz) => {
    const pending = summary?.businesses.find((b) => b.business_public_id === biz.public_id);
    const current = currentId ? biz.public_id === currentId : biz.type === currentType;
    return {
      biz,
      current,
      pending,
      work: pending ? actionCount(pending) : 0,
      unread: isBusinessType(biz.type) ? unreadFor(unread, biz.type) : 0,
    };
  });
  const others = rows.filter((r) => !r.current);
  const otherWork = others.reduce((n, r) => n + r.work, 0);
  const otherUnread = others.reduce((n, r) => n + r.unread, 0);

  const pick = (biz: Business) => {
    const result = useAuth.getState().selectBusiness(biz);
    if (result.ok) void navigate({ to: "/" });
  };

  const openPicker = () => {
    useAuth.getState().clearPanel();
    void navigate({ to: "/select-panel" });
  };

  const attention = otherWork > 0 || otherUnread > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted",
            attention ? "border-destructive/40" : "border-border/70",
          )}
          title={attention ? "Other panels need attention, click to see" : "Switch panel"}
        >
          <div className="hidden sm:block">
            <div className="text-xs font-semibold leading-tight">{label}</div>
            <div className="font-mono text-[9px] text-muted-foreground">GST · {gst}</div>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium sm:hidden">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {label}
          </span>
          {otherWork > 0 ? (
            <CountBadge value={otherWork} />
          ) : otherUnread > 0 ? (
            <span
              className="h-2 w-2 rounded-full bg-destructive"
              aria-label="Unread on other panels"
            />
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          {otherWork > 0 && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-destructive/70" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-1.5">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Your panels</DropdownMenuLabel>
        {rows.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">Loading…</div>
        ) : (
          rows.map((r) => {
            const tag = isBusinessType(r.biz.type) ? BUSINESS_TAG[r.biz.type] : null;
            const parts = r.pending ? pendingParts(r.pending) : [];
            const stock = r.pending ? r.pending.out_of_stock_items + r.pending.low_stock_items : 0;
            return (
              <DropdownMenuItem
                key={r.biz.public_id}
                className={cn("items-start gap-2.5 rounded-lg p-2", r.current && "bg-muted/60")}
                onSelect={() => !r.current && pick(r.biz)}
              >
                <span className="mt-0.5 text-lg leading-none">{tag?.emoji ?? "🏢"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{r.biz.name}</span>
                    {r.current && <Check className="h-3.5 w-3.5 text-primary" />}
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      parts.length ? "font-medium text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {parts.length ? parts.join(" · ") : "Nothing waiting"}
                  </span>
                  {(stock > 0 || r.unread > 0) && (
                    <span className="block text-[11px] text-muted-foreground">
                      {[
                        stock > 0 ? `${stock} stock alert${stock === 1 ? "" : "s"}` : null,
                        r.unread > 0 ? `${r.unread} unread` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                <span className="flex flex-col items-end gap-1">
                  <CountBadge value={r.work} />
                  {r.work === 0 && <CountBadge value={r.unread} muted />}
                </span>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 rounded-lg text-xs" onSelect={openPicker}>
          <LayoutGrid className="h-3.5 w-3.5" /> Open panel picker
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
