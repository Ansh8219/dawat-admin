import { createFileRoute } from "@tanstack/react-router";
import { AcceptingOrdersPanel } from "@/components/app/accepting-orders-panel";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_app/outlet-status")({
  component: OutletStatusPage,
  head: () => ({ meta: [{ title: "Outlet status — Daawat Baker's" }] }),
});

function OutletStatusPage() {
  return (
    <div>
      <PageHeader
        title="Outlet status"
        crumbs={["Operations", "Outlet status"]}
        description="Open or close Restaurant and Bakery independently. Closed outlets stop new customer orders."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <AcceptingOrdersPanel variant="cards" />
      </div>
    </div>
  );
}
