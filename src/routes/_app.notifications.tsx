import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { notifications as seedNotifications } from "@/lib/mock/data";
import { AlertTriangle, Calendar, UserCog, Truck, Megaphone, PackageX, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — Daawat Baker's" }] }),
});

const iconMap = { inventory: PackageX, booking: Calendar, staff: UserCog, order: Truck, campaign: Megaphone };
const priorityBorder: Record<string, string> = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-info",
};

function NotificationsPage() {
  const [items, setItems] = useState(seedNotifications);

  const today = items.filter((n) => n.group === "Today");
  const earlier = items.filter((n) => n.group === "Earlier");

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked read");
  };

  const markRead = (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    toast.success("Marked as read");
  };

  const dismiss = (id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    toast.message("Notification dismissed");
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        crumbs={["Admin", "Notifications"]}
        description="All alerts, approvals, and system messages."
        action={
          <Button variant="outline" className="rounded-xl gap-2" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_340px] sm:p-6 lg:p-8">
        <div className="space-y-4">
          {(["Today", "Earlier"] as const).map((label) => {
            const list = label === "Today" ? today : earlier;
            if (list.length === 0) return null;
            return (
              <div key={label}>
                <div className="mb-2 px-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
                <div className="space-y-2">
                  {list.map((n) => {
                    const Icon = iconMap[n.type as keyof typeof iconMap] ?? AlertTriangle;
                    return (
                      <div
                        key={n.id}
                        className={`card-elevated flex items-start gap-3 border-l-4 ${priorityBorder[n.priority]} p-3 ${!n.read ? "" : "opacity-70"}`}
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-medium">{n.title}</div>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{n.body}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{n.time}</div>
                        </div>
                        <RowActions
                          items={[
                            {
                              label: "Mark read",
                              onClick: () => markRead(n.id),
                              disabled: n.read,
                            },
                            {
                              label: "Dismiss",
                              onClick: () => dismiss(n.id),
                              destructive: true,
                            },
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          )}
        </div>

        <div className="card-elevated h-fit p-4">
          <div className="text-sm font-semibold">Delivery Preferences</div>
          <div className="mt-3 divide-y">
            {["Low stock alerts", "New bookings", "Order issues", "Staff approvals", "Campaigns"].map((t) => (
              <div key={t} className="py-3">
                <div className="text-sm font-medium">{t}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Push</span>
                  <Switch defaultChecked />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>SMS</span>
                  <Switch />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Email</span>
                  <Switch defaultChecked />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
