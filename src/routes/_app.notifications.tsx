import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  adminNotificationsKeys,
  formatNotificationTime,
  formatUnreadBadge,
  listAdminNotifications,
  markAllAdminNotificationsRead,
  markAdminNotificationRead,
  notificationTypeLabel,
} from "@/lib/api/notifications";
import { ApiError } from "@/lib/api/types";
import type { AdminNotification, AdminNotificationType } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Cog,
  Loader2,
  Package,
  ShoppingCart,
  UserCog,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;

type FilterTab = "all" | "unread";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
];

function typeIcon(type: AdminNotificationType) {
  switch (type) {
    case "stock":
      return Package;
    case "purchase":
      return ShoppingCart;
    case "account":
      return UserCog;
    case "wallet":
      return Wallet;
    case "system":
      return Cog;
    default:
      return Bell;
  }
}

function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [actingId, setActingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const listParams = {
    is_read: tab === "unread" ? false : undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const listQuery = useQuery({
    queryKey: adminNotificationsKeys.list(listParams),
    queryFn: async () => {
      try {
        return await withAuthRetry((token) => listAdminNotifications(token, listParams));
      } catch (err) {
        if (handleAuthError(err)) throw err;
        throw err;
      }
    },
  });

  const results = listQuery.data?.results ?? [];
  const count = listQuery.data?.count ?? 0;
  const unreadCount = listQuery.data?.unread_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const unreadBadge = formatUnreadBadge(unreadCount);

  function syncUnread(countValue: number) {
    queryClient.setQueryData(adminNotificationsKeys.unreadCount(), countValue);
  }

  async function markRead(n: AdminNotification) {
    if (n.is_read) return;
    setActingId(n.public_id);
    try {
      const data = await withAuthRetry((token) => markAdminNotificationRead(token, n.public_id));
      syncUnread(data.unread_count);
      await queryClient.invalidateQueries({ queryKey: adminNotificationsKeys.all });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to mark notification read");
    } finally {
      setActingId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const data = await withAuthRetry((token) => markAllAdminNotificationsRead(token));
      syncUnread(data.unread_count);
      await queryClient.invalidateQueries({ queryKey: adminNotificationsKeys.all });
      toast.success(
        data.marked_read === 0
          ? "Nothing to mark"
          : data.marked_read === 1
            ? "1 notification marked read"
            : `${data.marked_read} notifications marked read`,
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        crumbs={["Admin", "Notifications"]}
        description="Alerts for stock, purchases, accounts, and system events."
        action={
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={unreadCount === 0 || markingAll}
            onClick={() => void markAllRead()}
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Mark all read
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full border bg-card p-1">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {item.id === "unread" && unreadBadge && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                        active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground",
                      )}
                    >
                      {unreadBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={listQuery.isFetching}
            onClick={() => void listQuery.refetch()}
          >
            <Loader2 className={cn("mr-1.5 h-3.5 w-3.5", listQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {listQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading notifications…
          </div>
        ) : listQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {listQuery.error instanceof ApiError
                ? listQuery.error.message
                : "Unable to load notifications."}
            </div>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void listQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-20 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No notifications</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {tab === "unread"
                ? "You're all caught up — nothing unread."
                : "When the kitchen or inventory needs attention, alerts will show up here."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {results.map((n) => {
                const Icon = typeIcon(n.type);
                const busy = actingId === n.public_id;
                return (
                  <button
                    key={n.public_id}
                    type="button"
                    disabled={busy}
                    onClick={() => void markRead(n)}
                    className={cn(
                      "card-elevated flex w-full items-start gap-3 border p-3 text-left transition-colors hover:border-primary/30",
                      !n.is_read ? "border-primary/25 bg-primary/[0.03]" : "opacity-90",
                      busy && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                        !n.is_read
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{n.title}</span>
                        {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {notificationTypeLabel(n.type)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {n.message}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-muted-foreground">
                        {formatNotificationTime(n.created_at)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {count > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages} · {count} notifications
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
