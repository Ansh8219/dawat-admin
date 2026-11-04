import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/topbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useAdminOrdersSocket } from "@/hooks/use-admin-orders-socket";
import {
  useAuth,
  canCheckPersistedAuth,
  getSelectedPanel,
  isAuthenticated,
  mustChangePassword,
} from "@/lib/auth";
import { isRouteAllowed } from "@/lib/panel";
import { isRouteVisible } from "@/lib/access";

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
    const { access, user } = useAuth.getState();
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

  // Zomato-style: keep kitchen WS alive across all admin pages while authenticated.
  useAdminOrdersSocket({ enabled: true });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background print:block print:h-auto print:overflow-visible print:bg-white">
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
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
