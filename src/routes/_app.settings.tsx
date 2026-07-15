import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { branches, inr } from "@/lib/mock/data";
import { useApp } from "@/lib/store";
import { MapPin, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Daawat Baker's" }] }),
});

function SettingsPage() {
  const { dark, toggleDark } = useApp();
  return (
    <div>
      <PageHeader
        title="Settings"
        crumbs={["Admin", "Settings"]}
        description="Business, tax, printer, payment, and delivery configuration."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs defaultValue="business">
          <TabsList className="rounded-xl flex-wrap h-auto">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="printer">Printer</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Business Details</div>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label>Business Name</Label>
                    <Input
                      defaultValue="Daawat Baker's — A Designer Bakery Studio"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label>Head Office</Label>
                    <Input
                      defaultValue="12 MG Road, Gurugram, Haryana 122001"
                      className="mt-1 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Phone</Label>
                      <Input defaultValue="+91 98111 22334" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input defaultValue="hello@daawatbakers.in" className="mt-1 rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <Label>Logo</Label>
                    <button
                      type="button"
                      onClick={() => toast.message("Logo upload coming soon")}
                      className="mt-1 grid h-24 w-full place-items-center rounded-xl border-2 border-dashed text-xs text-muted-foreground hover:border-primary hover:bg-primary/5"
                    >
                      Upload new logo
                    </button>
                  </div>
                  <Button
                    className="rounded-xl"
                    onClick={() => toast.success("Business settings saved")}
                  >
                    Save Business
                  </Button>
                </div>
              </div>
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Branches & GST</div>
                <div className="mt-3 space-y-3">
                  {branches.map((b) => (
                    <div key={b.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">{b.label}</div>
                        <Switch defaultChecked />
                      </div>
                      <div className="mt-2">
                        <Label className="text-xs">GST Number</Label>
                        <Input defaultValue={b.gst} className="mt-1 rounded-lg font-mono text-xs" />
                      </div>
                    </div>
                  ))}
                  <Button
                    className="rounded-xl"
                    onClick={() => toast.success("Branch settings saved")}
                  >
                    Save Branches
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tax" className="mt-4">
            <div className="card-elevated max-w-lg p-4 space-y-3">
              <div className="text-sm font-semibold">GST Configuration</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CGST %</Label>
                  <Input defaultValue="2.5" className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label>SGST %</Label>
                  <Input defaultValue="2.5" className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label>IGST % (inter-state)</Label>
                  <Input defaultValue="5" className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label>Cess %</Label>
                  <Input defaultValue="0" className="mt-1 rounded-xl" />
                </div>
              </div>
              <Button className="rounded-xl" onClick={() => toast.success("Tax settings saved")}>
                Save Tax Settings
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="printer" className="mt-4">
            <div className="card-elevated max-w-lg p-4 space-y-3">
              <div className="text-sm font-semibold">Printer</div>
              <div>
                <Label>Default Printer</Label>
                <Input defaultValue="Epson TM-T82 (POS-01)" className="mt-1 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Paper Width</Label>
                  <Input defaultValue="80 mm" className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label>Copies per bill</Label>
                  <Input defaultValue="2" className="mt-1 rounded-xl" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm">Auto-print on bill generation</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm">Print KOT (Kitchen)</span>
                <Switch defaultChecked />
              </div>
              <Button className="rounded-xl" onClick={() => toast.success("Printer settings saved")}>
                Save Printer
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="payment" className="mt-4">
            <div className="card-elevated max-w-lg p-4">
              <div className="text-sm font-semibold">Enabled Payment Modes</div>
              <div className="mt-3 space-y-2">
                {["UPI", "Cash", "Card (POS)", "Net Banking", "Cash on Delivery", "Wallet"].map((m) => (
                  <div key={m} className="flex items-center justify-between rounded-xl border p-3">
                    <span className="text-sm">{m}</span>
                    <Switch defaultChecked={m !== "Wallet"} />
                  </div>
                ))}
              </div>
              <Button
                className="mt-4 rounded-xl"
                onClick={() => toast.success("Payment settings saved")}
              >
                Save Payment
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="delivery" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-elevated p-4 space-y-3">
                <div className="text-sm font-semibold">Delivery Zone</div>
                <div>
                  <Label>Free delivery radius: 3 km</Label>
                  <Slider defaultValue={[3]} min={1} max={15} className="mt-2" />
                </div>
                <div>
                  <Label>Per-km rate (₹)</Label>
                  <Input defaultValue="12" className="mt-1 rounded-xl" />
                </div>
                <div>
                  <Label>Min order for free delivery</Label>
                  <Input defaultValue={inr(499)} className="mt-1 rounded-xl" />
                </div>
                <div className="grid h-40 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-gold/10 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> Map placeholder — delivery zone
                  </div>
                </div>
                <Button className="rounded-xl" onClick={() => toast.success("Delivery settings saved")}>
                  Save Delivery
                </Button>
              </div>
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Zone-based Menu Visibility</div>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium py-2">Zone</th>
                      <th className="text-left font-medium">Menu</th>
                      <th className="text-right font-medium">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { z: "Sector 1–20 (Gurugram)", m: "Full Menu" },
                      { z: "DLF Phase 1–5", m: "Bakery + Restaurant" },
                      { z: "South Delhi", m: "Bakery only" },
                      { z: "Noida (up to 12km)", m: "Delivery Menu" },
                    ].map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2.5">{r.z}</td>
                        <td className="py-2.5 text-muted-foreground">{r.m}</td>
                        <td className="py-2.5 text-right">
                          <Switch defaultChecked />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Button
                  className="mt-4 rounded-xl"
                  onClick={() => toast.success("Zone visibility saved")}
                >
                  Save Zones
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="mt-4">
            <div className="card-elevated max-w-lg p-4">
              <div className="text-sm font-semibold">Appearance</div>
              <div className="mt-3 flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span className="text-sm">Dark Mode</span>
                </div>
                <Switch checked={dark} onCheckedChange={toggleDark} />
              </div>
              <Button
                className="mt-4 rounded-xl"
                onClick={() => toast.success("Appearance settings saved")}
              >
                Save Appearance
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
