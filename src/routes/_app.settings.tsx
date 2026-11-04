import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAccess } from "@/lib/access";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { usePanelMeta } from "@/lib/use-panel";
import { PickupMap } from "@/components/app/pickup-map";
import { BusinessProfileForm } from "@/components/app/business-profile-form";
import { BusinessInvoiceDetailsPanel } from "@/components/app/business-invoice-details";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const SETTINGS_TABS = ["business", "businesses", "delivery", "security"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const settingsSearchSchema = z.object({
  tab: z.enum(SETTINGS_TABS).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  validateSearch: settingsSearchSchema,
  head: () => ({ meta: [{ title: "Settings — Daawat Baker's" }] }),
});

function SettingsPage() {
  const meta = usePanelMeta();
  const user = useAuth((s) => s.user);
  const canChangePassword = isSuperAdmin(user);
  const navigate = useNavigate({ from: Route.fullPath });
  const platformAdmin = useAccess().isSuperAdmin;
  const requestedTab: SettingsTab = Route.useSearch().tab ?? "business";
  // Business profile, businesses and delivery are platform settings (super admin only).
  const tab: SettingsTab = platformAdmin ? requestedTab : "security";
  const setTab = (value: string) =>
    void navigate({
      search: { tab: value === "business" ? undefined : (value as SettingsTab) },
      replace: true,
    });

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
            {platformAdmin && (
              <>
                <TabsTrigger value="business">Business</TabsTrigger>
                <TabsTrigger value="businesses">Businesses</TabsTrigger>
                <TabsTrigger value="delivery">Delivery</TabsTrigger>
              </>
            )}
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <BusinessProfileForm />
              <div className="card-elevated p-4">
                <div className="text-sm font-semibold">GST & invoice details</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each business (Restaurant / Bakery) has its own GSTIN, FSSAI number and invoice
                  number series. Tax invoices are only issued once these are filled in.
                </p>
                <Button className="mt-3 rounded-xl" onClick={() => setTab("businesses")}>
                  Manage invoice details
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="businesses" className="mt-4">
            <BusinessInvoiceDetailsPanel />
          </TabsContent>

          <TabsContent value="delivery" className="mt-4">
            {platformAdmin && tab === "delivery" ? <DeliverySettingsForm /> : null}
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
  per_km_rate: "0.00",
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
          Search a place or drop a pin to set pickup. Delivery fee is always distance × per-km rate.
          There is no free delivery.
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

      <div>
        <Label htmlFor="per-km-rate">Per-km rate (₹)</Label>
        <Input
          id="per-km-rate"
          type="number"
          min={0}
          step="0.01"
          value={form.per_km_rate}
          onChange={(e) => setField("per_km_rate", e.target.value)}
          className="mt-1 max-w-xs rounded-xl"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Rupees per kilometre, 0 or greater, two decimal places.
        </p>
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
