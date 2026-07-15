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
import { staff as seedStaff, roles, modules } from "@/lib/mock/data";
import { UserPlus, Shield, Monitor } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/staff")({
  component: StaffPage,
  head: () => ({ meta: [{ title: "Staff & Roles — Daawat Baker's" }] }),
});

const roleMap: Record<string, string> = {
  Admin: "text-primary bg-primary/10",
  Manager: "text-info bg-info/10",
  "Store Keeper": "text-gold-foreground bg-gold/20",
  Cashier: "text-muted-foreground bg-muted",
  Driver: "text-success bg-success/10",
  Chef: "text-warning bg-warning/10",
};

type StaffMember = (typeof seedStaff)[number];

function StaffPage() {
  const [staff, setStaff] = useState(() => [...seedStaff]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "Cashier", branch: "Gurugram" });
  const [devices, setDevices] = useState([
    { id: "d1", name: "Rajeev Malhotra", device: "MacBook Pro · Chrome", loc: "Gurugram, HR", time: "Now" },
    { id: "d2", name: "Sunita Kapoor", device: "iPhone 15 · Safari", loc: "Delhi, DL", time: "22 min ago" },
    { id: "d3", name: "Deepak Verma", device: "Windows POS · Edge", loc: "Gurugram, HR", time: "1 hour ago" },
    { id: "d4", name: "Ritika Sharma", device: "iPad · POS", loc: "Gurugram, HR", time: "5 min ago" },
  ]);

  const pending = staff.filter((s) => s.status === "Pending");

  function setStatus(id: string, status: StaffMember["status"]) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  function invite() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    const next: StaffMember = {
      id: `ST-${100 + staff.length}`,
      name: form.name.trim(),
      role: form.role,
      branch: form.branch,
      status: "Pending",
      lastLogin: "Never",
    };
    setStaff((prev) => [next, ...prev]);
    setInviteOpen(false);
    setForm({ name: "", email: "", role: "Cashier", branch: "Gurugram" });
    toast.success(`Invite sent to ${next.name}`);
  }

  return (
    <div>
      <PageHeader
        title="Staff & Roles"
        crumbs={["Admin", "Staff"]}
        description="Manage team members, roles, permissions, and device access."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite Staff
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {pending.length > 0 && (
          <div className="card-elevated border-warning/40 bg-warning/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-warning">{pending.length} pending approvals</div>
                <div className="text-xs text-muted-foreground">Review new staff sign-ups</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {pending.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.role} · {s.branch}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => {
                        setStatus(s.id, "Inactive");
                        toast.message(`${s.name} rejected`);
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        setStatus(s.id, "Active");
                        toast.success(`${s.name} approved`);
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="team">
          <TabsList className="rounded-xl">
            <TabsTrigger value="team">Team Members</TabsTrigger>
            <TabsTrigger value="roles">
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Role Permissions
            </TabsTrigger>
            <TabsTrigger value="devices">
              <Monitor className="mr-1.5 h-3.5 w-3.5" /> Device Logins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Branch</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Last Login</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${roleMap[s.role] ?? "bg-muted"}`}>{s.role}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.branch}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status === "Pending" ? "Pending Approval" : s.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.lastLogin}</td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          items={[
                            { label: "Edit details", onClick: () => toast.message(`Edit ${s.name}`) },
                            { label: "Change role", onClick: () => toast.message(`Change role for ${s.name}`) },
                            {
                              label: s.status === "Active" ? "Deactivate" : "Activate",
                              onClick: () => {
                                setStatus(s.id, s.status === "Active" ? "Inactive" : "Active");
                                toast.success(`${s.name} ${s.status === "Active" ? "deactivated" : "activated"}`);
                              },
                            },
                            { label: "Reset access", onClick: () => toast.success(`Reset link sent to ${s.name}`) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <div className="card-elevated overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-semibold">Module</th>
                    {roles.map((r) => (
                      <th key={r} className="p-2 text-center font-semibold">
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m} className="border-t">
                      <td className="p-2 font-medium">{m}</td>
                      {roles.map((r) => {
                        const on = r === "Admin" || (r === "Manager" && !["Staff", "Finance"].includes(m));
                        return (
                          <td key={r} className="p-2 text-center">
                            <input type="checkbox" defaultChecked={on} className="accent-primary" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-end">
                <Button className="rounded-xl" onClick={() => toast.success("Role permissions saved")}>
                  Save Permissions
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="devices" className="mt-4">
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Staff</th>
                    <th className="px-4 py-3 text-left font-medium">Device</th>
                    <th className="px-4 py-3 text-left font-medium">Location</th>
                    <th className="px-4 py-3 text-left font-medium">Last Login</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">{r.device}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.loc}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.time}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-lg text-xs"
                            onClick={() => {
                              setDevices((prev) => prev.filter((d) => d.id !== r.id));
                              toast.success(`Session revoked for ${r.name}`);
                            }}
                          >
                            Revoke
                          </Button>
                          <RowActions
                            items={[
                              {
                                label: "Revoke session",
                                onClick: () => {
                                  setDevices((prev) => prev.filter((d) => d.id !== r.id));
                                  toast.success(`Session revoked for ${r.name}`);
                                },
                                destructive: true,
                              },
                              { label: "View activity", onClick: () => toast.message(`Activity for ${r.name}`) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Role</Label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Branch</Label>
              <Input value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} className="mt-1 rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={invite}>
                Send Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
