import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { drivers as seedDrivers, inr } from "@/lib/mock/data";
import { Star, Plus } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/drivers")({
  component: DriversPage,
  head: () => ({ meta: [{ title: "Drivers — Daawat Baker's" }] }),
});

type Driver = (typeof seedDrivers)[number];

function DriversPage() {
  const [drivers, setDrivers] = useState(() => [...seedDrivers]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [queue, setQueue] = useState([
    { id: "DB-1201", area: "Sector 45", assigned: "" },
    { id: "DB-1202", area: "DLF Phase 4", assigned: "" },
    { id: "DB-1203", area: "MG Road", assigned: "" },
  ]);
  const chart = Array.from({ length: 7 }).map((_, i) => ({
    d: ["M", "T", "W", "T", "F", "S", "S"][i],
    v: 400 + Math.round(Math.random() * 1400),
  }));

  function addDriver() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const next: Driver = {
      id: `DR-${100 + drivers.length}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      status: "Online",
      deliveries: 0,
      earnings: 0,
      rating: "5.0",
    };
    setDrivers((prev) => [next, ...prev]);
    setAddOpen(false);
    setForm({ name: "", phone: "" });
    toast.success(`${next.name} added`);
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        crumbs={["Growth", "Drivers"]}
        description="Delivery riders, live assignments, and earnings."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Driver
          </Button>
        }
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_360px] sm:p-6 lg:p-8">
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {drivers.map((d) => (
              <div key={d.id} className="card-elevated p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {d.name
                        .split(" ")
                        .map((s) => s[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.phone}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={d.status} />
                    <RowActions
                      items={[
                        { label: "View profile", onClick: () => toast.message(d.name) },
                        { label: "Edit", onClick: () => toast.message(`Edit ${d.name}`) },
                        {
                          label: d.status === "Online" ? "Set offline" : "Set online",
                          onClick: () => {
                            setDrivers((prev) =>
                              prev.map((x) =>
                                x.id === d.id ? { ...x, status: x.status === "Online" ? "Offline" : "Online" } : x,
                              ),
                            );
                            toast.success(`${d.name} status updated`);
                          },
                        },
                        {
                          label: "Deactivate",
                          onClick: () => {
                            setDrivers((prev) => prev.filter((x) => x.id !== d.id));
                            toast.success(`${d.name} deactivated`);
                          },
                          destructive: true,
                        },
                      ]}
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
                  <div>
                    <div className="text-muted-foreground">Deliveries</div>
                    <div className="font-semibold">{d.deliveries}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Earnings</div>
                    <div className="font-semibold">{inr(d.earnings)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Rating</div>
                    <div className="inline-flex items-center gap-0.5 font-semibold">
                      {d.rating}
                      <Star className="h-3 w-3 fill-gold text-gold" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-elevated p-4">
            <div className="text-sm font-semibold">Live Assignment Queue</div>
            <div className="mt-3 space-y-2">
              {queue.map((o) => (
                <div key={o.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{o.id}</span>
                    <StatusBadge status={o.assigned ? "Out for Delivery" : "Ready"} />
                  </div>
                  <div className="text-xs text-muted-foreground">{o.area}</div>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={o.assigned}
                      onChange={(e) =>
                        setQueue((prev) => prev.map((q) => (q.id === o.id ? { ...q, assigned: e.target.value } : q)))
                      }
                      className="w-full rounded-lg border px-2 py-1.5 text-xs"
                    >
                      <option value="">Assign driver…</option>
                      {drivers
                        .filter((d) => d.status === "Online")
                        .map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      className="h-8 shrink-0 rounded-lg"
                      disabled={!o.assigned}
                      onClick={() => toast.success(`${o.id} assigned to ${o.assigned}`)}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-4">
            <div className="text-sm font-semibold">Weekly Earnings — Top Rider</div>
            <div className="mt-2 text-xs text-muted-foreground">Ramesh Kumar</div>
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="d" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-card)", borderRadius: 12 }} />
                  <Bar dataKey="v" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={addDriver}>
                Save Driver
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
