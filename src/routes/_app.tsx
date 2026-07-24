import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/topbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { getSelectedPanel, isAuthenticated } from "@/lib/auth";
import { isRouteAllowed } from "@/lib/panel";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
    const panel = getSelectedPanel();
    if (!panel) {
      throw redirect({ to: "/select-panel" });
    }
    if (!isRouteAllowed(panel, location.pathname)) {
      throw redirect({ to: "/" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden lg:block">
        <AppSidebar />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <AppSidebar mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
