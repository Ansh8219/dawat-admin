import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { offers as seedOffers } from "@/lib/mock/data";
import { Plus, MessageCircle, Bell, Smartphone, Send, Calendar, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/marketing")({
  component: MarketingPage,
  head: () => ({ meta: [{ title: "Marketing & Offers — Daawat Baker's" }] }),
});

const offerTypes = ["Percentage", "Flat", "BOGO", "Combo"] as const;

function MarketingPage() {
  const [open, setOpen] = useState(false);
  const [offers, setOffers] = useState(seedOffers);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(seedOffers.map((o) => [o.code, o.active])),
  );
  const [offerType, setOfferType] = useState<(typeof offerTypes)[number]>("Percentage");
  const [newCode, setNewCode] = useState("");

  return (
    <div>
      <PageHeader
        title="Marketing & Offers"
        crumbs={["Growth", "Marketing"]}
        description="Coupons, combos, festivals, and multi-channel campaigns."
        action={
          <Button className="rounded-xl gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Create Offer
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs defaultValue="offers">
          <TabsList className="rounded-xl">
            <TabsTrigger value="offers">Offers</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="occasions">Occasion Banners</TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="mt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {offers.map((o) => (
                <div key={o.code} className="card-elevated relative overflow-hidden p-4">
                  <div className="absolute right-2 top-2 z-10">
                    <RowActions
                      items={[
                        { label: "Edit", onClick: () => toast.message(`Edit ${o.code}`) },
                        {
                          label: "Duplicate",
                          onClick: () => {
                            const code = `${o.code}-COPY`;
                            setOffers((prev) => [{ ...o, code }, ...prev]);
                            setEnabled((e) => ({ ...e, [code]: false }));
                            toast.success(`${code} duplicated`);
                          },
                        },
                        {
                          label: "View redemptions",
                          onClick: () => toast.message(`${o.used} redemptions · ${o.code}`),
                        },
                        { separator: true, label: "", onClick: () => {} },
                        {
                          label: "Delete",
                          onClick: () => {
                            setOffers((prev) => prev.filter((x) => x.code !== o.code));
                            toast.success(`${o.code} deleted`);
                          },
                          destructive: true,
                        },
                      ]}
                    />
                  </div>
                  <div className="absolute left-0 top-0 bg-primary/10 px-3 py-1 text-xs font-bold text-primary rounded-br-2xl">
                    {o.type}
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    COUPON
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tracking-wider">{o.code}</div>
                  <div className="mt-2 text-2xl font-bold text-primary">
                    {o.type === "Percentage"
                      ? `${o.value}% OFF`
                      : o.type === "Flat"
                        ? `₹${o.value} OFF`
                        : o.type === "Combo"
                          ? `₹${o.value}`
                          : "BOGO"}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    <div>
                      <div className="text-[10px] uppercase">Used</div>
                      <div className="font-semibold text-foreground">{o.used}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Audience</div>
                      <div className="truncate font-semibold text-foreground">{o.audience}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase">Expires</div>
                      <div className="font-semibold text-foreground">
                        {o.expiry.split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">{enabled[o.code] ? "Active" : "Paused"}</span>
                    <Switch
                      checked={!!enabled[o.code]}
                      onCheckedChange={(v) => setEnabled((e) => ({ ...e, [o.code]: v }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
              <div className="card-elevated p-4">
                <Tabs defaultValue="wa">
                  <TabsList>
                    <TabsTrigger value="wa">
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="push">
                      <Bell className="mr-1.5 h-3.5 w-3.5" /> Push
                    </TabsTrigger>
                    <TabsTrigger value="sms">
                      <Smartphone className="mr-1.5 h-3.5 w-3.5" /> SMS
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="wa" className="mt-4 space-y-3">
                    <div>
                      <Label>Template</Label>
                      <Input defaultValue="Diwali Special · 25% off" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Audience</Label>
                      <Input defaultValue="Gold + Platinum (486 customers)" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Message</Label>
                      <textarea
                        rows={5}
                        defaultValue="Namaste 🪔 Celebrate Diwali with Daawat Baker's premium sweets — use code DIWALI25 for 25% off. Order now!"
                        className="mt-1 w-full rounded-xl border p-3 text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => toast.success("WhatsApp draft saved")}>
                        Save Draft
                      </Button>
                      <Button className="gap-2" onClick={() => toast.success("WhatsApp campaign sent")}>
                        <Send className="h-4 w-4" /> Send Now
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="push" className="mt-4 space-y-3">
                    <div>
                      <Label>Title</Label>
                      <Input defaultValue="Weekend bakery specials are live" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Audience</Label>
                      <Input defaultValue="App users · last 30 days" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Body</Label>
                      <textarea
                        rows={5}
                        defaultValue="Fresh croissants & cakes ready for you. Tap to order before 8 PM!"
                        className="mt-1 w-full rounded-xl border p-3 text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => toast.success("Push draft saved")}>
                        Save Draft
                      </Button>
                      <Button className="gap-2" onClick={() => toast.success("Push notification sent")}>
                        <Send className="h-4 w-4" /> Send Now
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="sms" className="mt-4 space-y-3">
                    <div>
                      <Label>Sender ID</Label>
                      <Input defaultValue="DAAWAT" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Audience</Label>
                      <Input defaultValue="All SMS-opted customers" className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Message</Label>
                      <textarea
                        rows={5}
                        defaultValue="Daawat Baker's: New menu drops this weekend. Show this SMS for 10% off. Reply STOP to opt out."
                        className="mt-1 w-full rounded-xl border p-3 text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => toast.success("SMS draft saved")}>
                        Save Draft
                      </Button>
                      <Button className="gap-2" onClick={() => toast.success("SMS campaign sent")}>
                        <Send className="h-4 w-4" /> Send Now
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Campaign History</div>
                <div className="mt-3 space-y-2">
                  {[
                    { title: "Diwali WhatsApp Blast", sent: 2340, opened: "61%", clicked: "18%" },
                    { title: "Weekend Bakery Push", sent: 1240, opened: "72%", clicked: "22%" },
                    { title: "New Menu SMS", sent: 3800, opened: "44%", clicked: "9%" },
                  ].map((c, i) => (
                    <div key={i} className="rounded-xl border p-3 text-sm">
                      <div className="font-medium">{c.title}</div>
                      <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                        <span>
                          Sent <b className="text-foreground">{c.sent}</b>
                        </span>
                        <span>
                          Opened <b className="text-foreground">{c.opened}</b>
                        </span>
                        <span>
                          Clicked <b className="text-foreground">{c.clicked}</b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="occasions" className="mt-4">
            <div className="card-elevated p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <div className="text-sm font-semibold">Occasion Banner Calendar</div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {Array.from({ length: 28 }).map((_, i) => {
                  const day = i + 1;
                  const highlight = [4, 12, 18, 25].includes(day);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        toast.message(
                          highlight ? `Birthday banner · day ${day}` : `Configure banner · day ${day}`,
                        )
                      }
                      className={`aspect-square rounded-lg border p-2 text-left text-xs transition-colors hover:border-primary ${
                        highlight ? "border-gold bg-gold/10 text-gold-foreground" : "border-border"
                      }`}
                    >
                      <div className="font-bold">{day}</div>
                      {highlight && <div className="mt-1 text-[9px] font-medium">Birthday</div>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Auto-triggered offers for birthdays & anniversaries — configure per tier.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Offer Type</Label>
              <div className="mt-1 grid grid-cols-4 gap-1.5">
                {offerTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOfferType(t)}
                    className={`rounded-lg border p-2 text-xs hover:border-primary hover:bg-primary/5 ${
                      offerType === t ? "border-primary bg-primary/10 font-medium text-primary" : ""
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Coupon Code</Label>
                <Input
                  placeholder="e.g. SUMMER20"
                  className="mt-1 rounded-xl"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                />
              </div>
              <div>
                <Label>Value</Label>
                <Input placeholder="20" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Valid From</Label>
                <Input type="date" className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input type="date" className="mt-1 rounded-xl" />
              </div>
            </div>
            <div>
              <Label>Target Audience</Label>
              <Input defaultValue="All customers" className="mt-1 rounded-xl" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const code = (newCode || "NEWOFFER").toUpperCase();
                  setOffers((prev) => [
                    {
                      code,
                      type: offerType,
                      value: 20,
                      used: 0,
                      audience: "All",
                      expiry: "31 Dec 2026",
                      active: true,
                    },
                    ...prev,
                  ]);
                  setEnabled((e) => ({ ...e, [code]: true }));
                  toast.success(`${offerType} offer ${code} created`);
                  setNewCode("");
                  setOpen(false);
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
