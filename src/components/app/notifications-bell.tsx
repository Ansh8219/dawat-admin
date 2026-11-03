import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  CheckCheck,
  Loader2,
  Package,
  ShoppingCart,
  UserCog,
  Wallet,
  Cog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  adminNotificationsKeys,
  formatNotificationTime,
  formatUnreadBadge,
  getAdminNotificationsUnreadCount,
  listAdminNotifications,
  markAllAdminNotificationsRead,
  markAdminNotificationRead,
  notificationTypeLabel,
} from "@/lib/api/notifications";
import { ApiError } from "@/lib/api/types";
import type { AdminNotification, AdminNotificationType } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PREVIEW_SIZE = 10;
const UNREAD_POLL_MS = 45_000;

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

export function NotificationsBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const unreadQuery = useQuery({
    queryKey: adminNotificationsKeys.unreadCount(),
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const data = await withAuthRetry((token) => getAdminNotificationsUnreadCount(token));
      return data.unread_count ?? 0;
    },
  });

  const previewQuery = useQuery({
    queryKey: adminNotificationsKeys.preview(),
    enabled: open,
    queryFn: async () => {
      return withAuthRetry((token) =>
        listAdminNotifications(token, { page: 1, page_size: PREVIEW_SIZE }),
      );
    },
  });

  const setUnread = (count: number) => {
    queryClient.setQueryData(adminNotificationsKeys.unreadCount(), count);
  };

  const invalidateLists = () => {
    void queryClient.invalidateQueries({ queryKey: adminNotificationsKeys.all });
  };

  const readOne = useMutation({
    mutationFn: (publicId: string) =>
      withAuthRetry((token) => markAdminNotificationRead(token, publicId)),
    onSuccess: (data) => {
      setUnread(data.unread_count);
      invalidateLists();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Unable to mark notification read");
    },
  });

  const readAll = useMutation({
    mutationFn: () => withAuthRetry((token) => markAllAdminNotificationsRead(token)),
    onSuccess: (data) => {
      setUnread(data.unread_count);
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

  const unread = unreadQuery.data ?? 0;
  const badge = formatUnreadBadge(unread);
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
    void navigate({ to: "/notifications" });
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

        <div className="max-h-96 overflow-y-auto">
          {loadingPreview && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
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
                      {notificationTypeLabel(n.type)} · {formatNotificationTime(n.created_at)}
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
