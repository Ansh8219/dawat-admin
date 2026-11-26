import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { typeIcon } from "./notification-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  adminNotificationsKeys,
  formatNotificationTime,
  formatUnreadBadge,
  listAdminNotifications,
  markAllAdminNotificationsRead,
  markAdminNotificationRead,
  notificationTarget,
  notificationTypeLabel,
} from "@/lib/api/notifications";
import { ApiError } from "@/lib/api/types";
import type { AdminNotification, BusinessType } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { setUnreadCounts, useUnreadCounts } from "@/hooks/use-cross-business";
import {
  BUSINESS_TAG,
  BUSINESS_TYPE_ORDER,
  businessTag,
  useGoToBusiness,
} from "@/lib/business-nav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PREVIEW_SIZE = 10;

type BellTab = BusinessType | "all";

export function NotificationsBell() {
  const navigate = useNavigate();
  const goTo = useGoToBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<BellTab>("all");

  const unreadQuery = useUnreadCounts();
  const byBusiness = unreadQuery.data?.by_business_type;
  // Tabs only for businesses the server reports (= the ones this user can access).
  const businessTabs = BUSINESS_TYPE_ORDER.filter((t) => byBusiness && t in byBusiness);

  const previewQuery = useQuery({
    queryKey: adminNotificationsKeys.preview(tab),
    enabled: open,
    queryFn: async () => {
      return withAuthRetry((token) =>
        listAdminNotifications(token, {
          page: 1,
          page_size: PREVIEW_SIZE,
          business_type: tab === "all" ? undefined : tab,
        }),
      );
    },
  });

  const invalidateLists = () => {
    void queryClient.invalidateQueries({
      queryKey: adminNotificationsKeys.all,
      predicate: (q) => q.queryKey[1] !== "unread-count",
    });
  };

  const readOne = useMutation({
    mutationFn: (publicId: string) =>
      withAuthRetry((token) => markAdminNotificationRead(token, publicId)),
    onSuccess: (data) => {
      setUnreadCounts(queryClient, data);
      invalidateLists();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Unable to mark notification read");
    },
  });

  const readAll = useMutation({
    mutationFn: () =>
      withAuthRetry((token) =>
        markAllAdminNotificationsRead(token, tab === "all" ? undefined : tab),
      ),
    onSuccess: (data) => {
      setUnreadCounts(queryClient, data);
      invalidateLists();
      if (data.marked_read > 0) {
        toast.success(
          data.marked_read === 1
            ? "1 notification marked read"
            : `${data.marked_read} notifications marked read`,
        );
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Unable to mark all as read");
    },
  });

  const totalUnread = unreadQuery.data?.unread_count ?? 0;
  const unread = tab === "all" ? totalUnread : (byBusiness?.[tab] ?? 0);
  const badge = formatUnreadBadge(totalUnread);
  const results = previewQuery.data?.results ?? [];
  const loadingPreview = previewQuery.isLoading || previewQuery.isFetching;

  async function onRowClick(n: AdminNotification) {
    if (!n.is_read) {
      try {
        await readOne.mutateAsync(n.public_id);
      } catch {
        return;
      }
    }
    setOpen(false);
    const target = notificationTarget(n);
    void goTo({
      businessPublicId: target.businessPublicId,
      businessType: target.businessType,
      to: target.to,
      search: target.search,
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {badge && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-start justify-between gap-2 border-b p-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">
              {unread === 0 ? "All caught up" : `${unread} unread`}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-lg px-2 text-xs"
            disabled={unread === 0 || readAll.isPending}
            onClick={() => void readAll.mutateAsync()}
          >
            {readAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Mark all read
          </Button>
        </div>

        {businessTabs.length > 1 && (
          <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5">
            {(["all", ...businessTabs] as BellTab[]).map((t) => {
              const active = tab === t;
              const count = t === "all" ? totalUnread : (byBusiness?.[t] ?? 0);
              const label =
                t === "all" ? "All" : `${BUSINESS_TAG[t].emoji} ${BUSINESS_TAG[t].label}`;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[9px] font-bold",
                        active
                          ? "bg-primary-foreground/25"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {formatUnreadBadge(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          {loadingPreview && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : previewQuery.isError ? (
            <div className="px-3 py-8 text-center text-sm text-destructive">
              {previewQuery.error instanceof ApiError
                ? previewQuery.error.message
                : "Unable to load notifications."}
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            results.map((n) => {
              const Icon = typeIcon(n.type);
              return (
                <button
                  key={n.public_id}
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b p-3 text-left text-sm transition-colors hover:bg-muted/40",
                    !n.is_read && "bg-primary/5",
                  )}
                  onClick={() => void onRowClick(n)}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                      !n.is_read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{n.title}</span>
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {n.message}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {[
                        tab === "all" ? businessTag(n.business_type) : "",
                        notificationTypeLabel(n.type),
                        formatNotificationTime(n.created_at),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full rounded-lg text-xs"
            onClick={() => {
              setOpen(false);
              void navigate({ to: "/notifications" });
            }}
          >
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
