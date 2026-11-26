import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlobalProgress } from "@/components/app/global-progress";
import { BootSplash } from "@/components/app/boot-splash";
import { AppSidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/topbar";
import { CrossBusinessStrip } from "@/components/app/cross-business-strip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAdminOrdersSocket } from "@/hooks/use-admin-orders-socket";
import { useLateOrderWatcher } from "@/hooks/use-late-order-watcher";
import { usePendingReminder, useUnreadCounts } from "@/hooks/use-cross-business";
import { useTabAttention } from "@/lib/realtime/attention";
import {
  useAuth,
  canCheckPersistedAuth,
  getSelectedPanel,
  isAuthenticated,
  mustChangePassword,
} from "@/lib/auth";
import { isRouteAllowed } from "@/lib/panel";
import { isRouteVisible } from "@/lib/access";
import { isBusinessTypeAllowed } from "@/lib/business-scope";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    if (!canCheckPersistedAuth()) return;
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
    if (mustChangePassword()) {
      throw redirect({ to: "/change-password" });
    }
    const panel = getSelectedPanel();
    if (!panel) {
      throw redirect({ to: "/select-panel" });
    }
    // Existing sessions (or a fresh password change) may not have access loaded yet.
    if (!useAuth.getState().access) {
      await useAuth.getState().loadAccess();
    }
    const { access, user, business } = useAuth.getState();
    // Panel picked before the manager's business access was narrowed (or forged in storage).
    if (business && !isBusinessTypeAllowed(access, user?.role, business.type)) {
      useAuth.getState().clearPanel();
      throw redirect({ to: "/select-panel" });
    }
    const allowed =
      isRouteAllowed(panel, location.pathname) &&
      isRouteVisible(location.pathname, panel, {
        access,
        role: user?.role,
      });
    if (!allowed) {
      throw redirect({ to: "/" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // The server render has no session, so the sidebar/topbar used to pop in piece by piece.
  // Show an intro until the client has the session + permissions, then reveal the shell at once.
  useEffect(() => {
    let alive = true;
    const minDelay = new Promise((r) => window.setTimeout(r, 350));
    const auth = useAuth.getState();
    const access =
      auth.getAccessToken() && !auth.access
        ? auth.loadAccess().catch(() => false)
        : Promise.resolve(true);
    void Promise.all([minDelay, access]).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Access (permissions + business_types) can be changed by a super admin at any time. Re-read
  // it on load and when the tab regains focus; a lost panel sends the user to the picker.
  const navigate = useNavigate();
  const businessId = useAuth((s) => s.business?.publicId ?? null);
  const signedIn = useAuth((s) => Boolean(s.user));
  useEffect(() => {
    let last = 0;
    const recheck = () => {
      const now = Date.now();
      if (now - last < 60_000) return;
      last = now;
      void useAuth.getState().loadAccess();
    };
    recheck();
    const onVisible = () => document.visibilityState === "visible" && recheck();
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  useEffect(() => {
    if (ready && signedIn && !businessId) void navigate({ to: "/select-panel" });
  }, [ready, signedIn, businessId, navigate]);

  // Zomato-style: keep kitchen WS alive across all admin pages while authenticated.
  useAdminOrdersSocket({ enabled: true });
  // Late-order sound + toast on every page (not only Orders).
  useLateOrderWatcher();
  // Rings again while orders / counter payments wait too long, in any business.
  usePendingReminder();
  // "(3) Daawat…" in the tab title + red dot on the favicon while notifications are unread.
  const unreadTotal = useUnreadCounts().data?.unread_count ?? 0;
  useTabAttention(unreadTotal);

  if (!ready) return <BootSplash />;

  return (
    <div className="app-shell-in flex h-screen w-full overflow-hidden bg-background print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="hidden lg:block print:hidden">
        <AppSidebar />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <AppSidebar mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <div className="print:hidden">
          <TopBar onMenu={() => setMobileOpen(true)} />
          <CrossBusinessStrip />
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <Outlet />
        </main>
      </div>
      <GlobalProgress />
      <Toaster position="top-right" />
    </div>
  );
}
