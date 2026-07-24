import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tables as seedTables, banquetEvents, decorationPackages, inr } from "@/lib/mock/data";
import { usePanel, usePanelMeta } from "@/lib/use-panel";
import { Plus, Users, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bookings")({
  component: BookingsPage,
  head: () => ({ meta: [{ title: "Tables & Bookings — Daawat Baker's" }] }),
});

const seedReservations = [
  { id: 1, name: "Aarav Sharma", time: "Today 8:30 PM", party: 4 },
  { id: 2, name: "Meera Joshi", time: "Tomorrow 1:00 PM", party: 6 },
  { id: 3, name: "Vikram Singh", time: "12 Jul · 7:00 PM", party: 2 },
];

function BookingsPage() {
  const panel = usePanel();
  const meta = usePanelMeta();
  const [open, setOpen] = useState(false);
  const [reservations, setReservations] = useState(seedReservations);
  const [floorTables, setFloorTables] = useState(seedTables);
  const [pkg, setPkg] = useState(decorationPackages[0]?.name ?? "");
  const showTables = panel === "restaurant";
  const showBanquet = panel === "banquet";

  const approve = (id: number, name: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    toast.success(`${name} approved`);
  };

  const reject = (id: number, name: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    toast.message(`${name} rejected`);
  };

  const cycleTable = (id: string) => {
    setFloorTables((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next =
          t.status === "Available" ? "Reserved" : t.status === "Reserved" ? "Occupied" : "Available";
        toast.message(`${id} marked ${next}`);
        return { ...t, status: next as typeof t.status, orderId: undefined, amount: undefined };
      }),
    );
  };

  return (
    <div>
      <PageHeader
        title={showBanquet ? "Banquet Bookings" : "Tables & Bookings"}
        crumbs={["Operations", "Bookings"]}
        description={
          showBanquet
            ? `Banquet hall calendar & contracts · GST ${meta.gst}`
            : `Restaurant floor plan only · GST ${meta.gst}`
        }
        action={
          <Button className="rounded-xl gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Booking
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {showTables && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Legend color="bg-success" label="Available" />
              <Legend color="bg-destructive" label="Occupied" />
              <Legend color="bg-warning" label="Reserved" />
            </div>
            <div className="card-elevated p-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
                {floorTables.map((t) => {
                  const tone =
                    t.status === "Available"
                      ? "border-success/50 bg-success/5"
                      : t.status === "Occupied"
                        ? "border-destructive/50 bg-destructive/5"
                        : "border-warning/50 bg-warning/5";
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => cycleTable(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") cycleTable(t.id);
                      }}
                      className={`relative rounded-2xl border-2 ${tone} p-4 text-center transition-transform hover:-translate-y-0.5 cursor-pointer`}
                    >
                      <div className="absolute right-1 top-1" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          items={[
                            {
                              label: "Mark available",
                              onClick: () => {
                                setFloorTables((prev) =>
                                  prev.map((x) =>
                                    x.id === t.id
                                      ? { ...x, status: "Available" as const, orderId: undefined, amount: undefined }
                                      : x,
                                  ),
                                );
                                toast.success(`${t.id} available`);
                              },
                            },
                            {
                              label: "Reserve",
                              onClick: () => {
                                setFloorTables((prev) =>
                                  prev.map((x) =>
                                    x.id === t.id ? { ...x, status: "Reserved" as const } : x,
                                  ),
                                );
                                toast.success(`${t.id} reserved`);
                              },
                            },
                            {
                              label: "Occupy",
                              onClick: () => {
                                setFloorTables((prev) =>
                                  prev.map((x) =>
                                    x.id === t.id ? { ...x, status: "Occupied" as const } : x,
                                  ),
                                );
                                toast.success(`${t.id} occupied`);
                              },
                            },
                          ]}
                        />
                      </div>
                      <div className="text-lg font-bold">{t.id}</div>
                      <div className="text-xs text-muted-foreground">{t.seats} seats</div>
                      <div className="mt-2 flex justify-center">
                        <StatusBadge status={t.status} />
                      </div>
                      {t.orderId && (
                        <div className="mt-2 border-t pt-2 text-xs">
                          <div className="font-medium">{t.orderId}</div>
                          <div className="text-primary font-bold">{inr(t.amount!)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-elevated p-4">
              <div className="mb-3 text-sm font-semibold">Pending Reservations</div>
              {reservations.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No pending reservations</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium">Guest</th>
                      <th className="py-2 text-left font-medium">Time</th>
                      <th className="py-2 text-left font-medium">Party</th>
                      <th className="py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="py-2.5">{r.name}</td>
                        <td className="py-2.5 text-muted-foreground">{r.time}</td>
                        <td className="py-2.5">{r.party}</td>
                        <td className="py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="mr-1 h-7 rounded-lg"
                            onClick={() => reject(r.id, r.name)}
                          >
                            Reject
                          </Button>
                          <Button size="sm" className="h-7 rounded-lg" onClick={() => approve(r.id, r.name)}>
                            Approve
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {showBanquet && (
            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <div className="card-elevated p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">July 2026</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> Month view
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }).map((_, i) => {
                    const day = i + 1;
                    const ev = banquetEvents.find((e) => e.date === day);
                    return (
                      <div
                        key={day}
                        className={`aspect-square rounded-lg border p-1.5 text-left text-xs ${
                          ev ? "border-primary/40 bg-primary/5" : "border-border/60"
                        }`}
                      >
                        <div className="font-medium">{day}</div>
                        {ev && (
                          <div className="mt-0.5 truncate text-[9px] font-medium text-primary">
                            {ev.title.split(" ").slice(0, 2).join(" ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Upcoming Events</div>
                <div className="mt-3 space-y-2">
                  {banquetEvents.map((e) => (
                    <div key={e.date} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{e.title}</div>
                        <div className="flex items-center gap-1">
                          <div className="text-xs font-medium text-primary">{e.date} Jul</div>
                          <RowActions
                            items={[
                              { label: "View contract", onClick: () => toast.message(e.title) },
                              { label: "Edit event", onClick: () => toast.message(`Edit · ${e.title}`) },
                              {
                                label: "Collect advance",
                                onClick: () => toast.success(`Advance reminder sent for ${e.title}`),
                              },
                              { separator: true, label: "", onClick: () => {} },
                              {
                                label: "Cancel event",
                                onClick: () => toast.message(`${e.title} cancelled`),
                                destructive: true,
                              },
                            ]}
                          />
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {e.guests}
                        </span>
                        <span>{e.pkg}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Advance {e.advance}%</span>
                          <span className="font-semibold">
                            {inr((e.total * e.advance) / 100)} / {inr(e.total)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${e.advance}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Banquet Booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Event Type</Label>
              <Input placeholder="Wedding / Birthday…" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Guest Count</Label>
              <Input type="number" placeholder="150" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Contact</Label>
              <Input placeholder="+91 98…" className="mt-1 rounded-xl" />
            </div>
          </div>
          <div>
            <Label>Decoration Package</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {decorationPackages.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setPkg(p.name)}
                  className={`rounded-xl border p-3 text-left hover:border-primary hover:bg-primary/5 ${
                    pkg === p.name ? "border-primary bg-primary/10" : ""
                  }`}
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-0.5 text-xs text-primary font-bold">{inr(p.price)}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{p.features.join(" · ")}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-primary/5 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Estimated Total</span>
              <span className="font-bold text-primary">{inr(280000)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Advance (25%) required</span>
              <span className="font-semibold">{inr(70000)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success(`Contract generated · ${pkg || "package"}`);
                setOpen(false);
              }}
            >
              Generate Contract
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
