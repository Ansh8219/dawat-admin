import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  buildDeliverySettingsPatch,
  getDeliverySettings,
  settingsToForm,
  updateDeliverySettings,
  type DeliverySettingsForm as DeliveryFormState,
} from "@/lib/api/delivery-settings";
import { ApiError } from "@/lib/api/types";
import type { DeliverySettings } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { formatRoleLabel, isSuperAdmin, useAuth } from "@/lib/auth";
import { useApp } from "@/lib/store";
import { usePanelMeta } from "@/lib/use-panel";
import { PickupMap } from "@/components/app/pickup-map";
import { Loader2, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Daawat Baker's" }] }),
});

function SettingsPage() {
  const { dark, toggleDark } = useApp();
  const meta = usePanelMeta();
  const user = useAuth((s) => s.user);
  const canChangePassword = isSuperAdmin(user);
  const [tab, setTab] = useState("business");

  return (
    <div>
      <PageHeader
        title={`${meta.label} Settings`}
        crumbs={["Admin", "Settings"]}
        description={`Configuration for ${meta.label} · GST ${meta.gst}`}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl flex-wrap h-auto">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="printer">Printer</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Business Details</div>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label>Panel / Unit</Label>
                    <Input value={meta.label} readOnly className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label>Business Name</Label>
                    <Input
                      defaultValue={`Daawat Baker's — ${meta.label}`}
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
                <div className="text-sm font-semibold">GST for this panel</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each panel (Bakery / Restaurant / Banquet) has its own GSTIN — they never mix.
                </p>
                <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="mt-2">
                    <Label className="text-xs">GST Number</Label>
                    <Input defaultValue={meta.gst} className="mt-1 rounded-lg font-mono text-xs" />
                  </div>
                </div>
                <Button
                  className="mt-3 rounded-xl"
                  onClick={() => toast.success(`${meta.label} GST saved`)}
                >
                  Save GST
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tax" className="mt-4">
            <div className="card-elevated max-w-lg p-4 space-y-3">
              <div className="text-sm font-semibold">GST Configuration — {meta.label}</div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs">
                GSTIN · {meta.gst}
              </div>
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
              <Button
                className="rounded-xl"
                onClick={() => toast.success("Printer settings saved")}
              >
                Save Printer
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="payment" className="mt-4">
            <div className="card-elevated max-w-lg p-4">
              <div className="text-sm font-semibold">Enabled Payment Modes</div>
              <div className="mt-3 space-y-2">
                {["UPI", "Cash", "Card (POS)", "Net Banking", "Cash on Delivery", "Wallet"].map(
                  (m) => (
                    <div
                      key={m}
                      className="flex items-center justify-between rounded-xl border p-3"
                    >
                      <span className="text-sm">{m}</span>
                      <Switch defaultChecked={m !== "Wallet"} />
                    </div>
                  ),
                )}
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
            {tab === "delivery" ? <DeliverySettingsForm /> : null}
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

          <TabsContent value="security" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Account</div>
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="font-medium">{user?.email ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="font-medium">{formatRoleLabel(user?.role)}</div>
                  </div>
                </div>
              </div>

              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">Change password</div>
                {canChangePassword ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Only super admins can change their password here.
                    </p>
                    <ChangePasswordForm />
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Password changes for your role must be done by a super admin, or via the forgot
                    password flow.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const EMPTY_DELIVERY_FORM: DeliveryFormState = {
  pickup_name: "",
  pickup_address: "",
  latitude: "",
  longitude: "",
  free_delivery_radius_km: "0",
  per_km_rate: "0",
  min_order_for_free_delivery: "0",
};

function DeliverySettingsForm() {
  const navigate = useNavigate();
  const [original, setOriginal] = useState<DeliverySettings | null>(null);
  const [form, setForm] = useState<DeliveryFormState>(EMPTY_DELIVERY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const applySettings = useCallback((data: DeliverySettings) => {
    setOriginal(data);
    setForm(settingsToForm(data));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await withAuthRetry((token) => getDeliverySettings(token));
      applySettings(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load delivery settings.");
    } finally {
      setLoading(false);
    }
  }, [applySettings, handleAuthError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function setField<K extends keyof DeliveryFormState>(key: K, value: DeliveryFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formError) setFormError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!original) return;
    setFormError("");

    const result = buildDeliverySettingsPatch(form, original);
    if (!result.ok) {
      if (result.error === "No changes to save.") {
        toast.message(result.error);
        return;
      }
      setFormError(result.error);
      toast.error(result.error);
      return;
    }

    setSaving(true);
    try {
      const updated = await withAuthRetry((token) => updateDeliverySettings(token, result.payload));
      applySettings(updated);
      toast.success("Delivery settings saved");
    } catch (err) {
      if (handleAuthError(err)) return;
      const message = err instanceof ApiError ? err.message : "Unable to save delivery settings.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card-elevated flex max-w-2xl items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading delivery settings…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card-elevated max-w-2xl space-y-3 p-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
        <Button type="button" className="rounded-xl" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-elevated max-w-2xl space-y-4 p-4">
      <div>
        <div className="text-sm font-semibold">Delivery settings</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Search a place or drop a pin to set pickup, then set delivery charges.
        </p>
      </div>

      <div>
        <Label htmlFor="pickup-name">Pickup name</Label>
        <Input
          id="pickup-name"
          value={form.pickup_name}
          onChange={(e) => setField("pickup_name", e.target.value)}
          placeholder="Daawat Restaurant"
          className="mt-1 rounded-xl"
        />
      </div>

      <div>
        <Label htmlFor="pickup-address">Pickup address</Label>
        <Textarea
          id="pickup-address"
          value={form.pickup_address}
          onChange={(e) => setField("pickup_address", e.target.value)}
          placeholder="Sector 70, Mohali, Punjab"
          className="mt-1 min-h-[80px] rounded-xl"
        />
      </div>

      <PickupMap
        latitude={form.latitude}
        longitude={form.longitude}
        popupLabel={form.pickup_name || form.pickup_address || "Pickup location"}
        onPick={(lat, lng) => {
          const latText = String(Number(lat.toFixed(6)));
          const lngText = String(Number(lng.toFixed(6)));
          setForm((prev) => ({ ...prev, latitude: latText, longitude: lngText }));
          if (formError) setFormError("");
        }}
        onPlaceLabel={(label) => {
          setForm((prev) =>
            prev.pickup_address.trim() ? prev : { ...prev, pickup_address: label },
          );
        }}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="free-radius">Free delivery radius (km)</Label>
          <Input
            id="free-radius"
            type="number"
            min={0}
            step="any"
            value={form.free_delivery_radius_km}
            onChange={(e) => setField("free_delivery_radius_km", e.target.value)}
            className="mt-1 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="per-km-rate">Per-km rate (₹)</Label>
          <Input
            id="per-km-rate"
            type="number"
            min={0}
            step="any"
            value={form.per_km_rate}
            onChange={(e) => setField("per_km_rate", e.target.value)}
            className="mt-1 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="min-order">Min order for free delivery (₹)</Label>
          <Input
            id="min-order"
            type="number"
            min={0}
            step="any"
            value={form.min_order_for_free_delivery}
            onChange={(e) => setField("min_order_for_free_delivery", e.target.value)}
            className="mt-1 rounded-xl"
          />
        </div>
      </div>

      {formError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      <Button type="submit" className="rounded-xl" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          "Save Delivery"
        )}
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const changePassword = useAuth((s) => s.changePassword);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await changePassword(oldPassword, password, passwordConfirm);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOldPassword("");
      setPassword("");
      setPasswordConfirm("");
      toast.success(result.detail || "Password has been changed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      <div>
        <Label htmlFor="old-password">Current password</Label>
        <Input
          id="old-password"
          type="password"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="mt-1 rounded-xl"
          required
        />
      </div>
      <div>
        <Label htmlFor="settings-new-password">New password</Label>
        <Input
          id="settings-new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 rounded-xl"
          required
        />
      </div>
      <div>
        <Label htmlFor="settings-confirm-password">Confirm new password</Label>
        <Input
          id="settings-confirm-password"
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="mt-1 rounded-xl"
          required
        />
      </div>
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button type="submit" className="rounded-xl" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}
