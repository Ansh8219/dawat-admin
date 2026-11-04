import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listBusinesses, updateBusinessProfile } from "@/lib/api/businesses";
import { ApiError } from "@/lib/api/types";
import type { BusinessProfile } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_LOGO_BYTES = 10 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const NAME_MIN = 2;
const NAME_MAX = 255;

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function validateName(name: string): string {
  const len = name.trim().length;
  if (len < NAME_MIN || len > NAME_MAX) {
    return `Business name must be ${NAME_MIN}–${NAME_MAX} characters.`;
  }
  return "";
}

function validateLogo(file: File): string {
  const okType = ALLOWED_LOGO_TYPES.includes(file.type);
  if (!okType) return "Logo must be a PNG, JPG, WEBP or SVG image.";
  if (file.size > MAX_LOGO_BYTES) return "Logo must be 10 MB or smaller.";
  return "";
}

export function BusinessProfileForm() {
  const activeBusiness = useAuth((s) => s.business);
  const user = useAuth((s) => s.user);

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const list = await withAuthRetry((token) => listBusinesses(token));
      const current =
        list.find((b) => b.public_id === activeBusiness?.publicId) ??
        list.find((b) => b.type === activeBusiness?.type);
      if (!current) {
        setLoadError("Business not found. Please select a business again.");
        return;
      }
      setProfile({
        public_id: current.public_id,
        panel_unit: current.type,
        name: current.name,
        logo: current.image,
        email: user?.email ?? "",
      });
      setName(current.name);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load business details.");
    } finally {
      setLoading(false);
    }
  }, [activeBusiness?.publicId, activeBusiness?.type, user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  // Object URL for the newly chosen file; revoked on change/unmount.
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const dirty = useMemo(
    () => Boolean(profile) && (name.trim() !== profile!.name || logoFile !== null),
    [profile, name, logoFile],
  );

  const onPickLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateLogo(file);
    setLogoError(err);
    if (err) {
      setLogoFile(null);
      return;
    }
    setLogoFile(file);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !dirty || saving) return;

    const nameChanged = name.trim() !== profile.name;
    const nErr = nameChanged ? validateName(name) : "";
    setNameError(nErr);
    if (nErr) return;
    if (logoError && !logoFile) setLogoError("");

    const fd = new FormData();
    if (nameChanged) fd.append("name", name.trim());
    if (logoFile) fd.append("logo", logoFile);

    setSaving(true);
    try {
      const updated = await withAuthRetry((token) =>
        updateBusinessProfile(token, profile.public_id, fd),
      );
      setProfile(updated);
      setName(updated.name);
      setLogoFile(null);
      setNameError("");
      setLogoError("");
      // Keep sidebar / headers in sync with the saved profile.
      const cur = useAuth.getState().business;
      if (cur && cur.publicId === updated.public_id) {
        useAuth.setState({ business: { ...cur, name: updated.name, image: updated.logo } });
      }
      toast.success("Business profile saved");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "invalid_name") setNameError(err.message);
        else if (err.code === "invalid_logo" || err.code === "file_too_large") {
          setLogoError(err.message);
        }
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-elevated flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading business details…
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="card-elevated p-4">
        <p className="text-sm text-destructive">{loadError || "Business not found."}</p>
        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const shownLogo = logoPreview ?? profile.logo;

  return (
    <form onSubmit={onSubmit} className="card-elevated p-4" noValidate>
      <div className="text-sm font-semibold">Business Profile</div>
      <div className="mt-3 space-y-3">
        <div>
          <Label htmlFor="bp-panel">Panel / Unit</Label>
          <Input
            id="bp-panel"
            value={titleCase(profile.panel_unit)}
            readOnly
            disabled
            className="mt-1 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="bp-name">Business Name</Label>
          <Input
            id="bp-name"
            value={name}
            maxLength={NAME_MAX}
            disabled={saving}
            aria-invalid={Boolean(nameError)}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            onBlur={() => {
              if (name.trim() !== profile.name) setNameError(validateName(name));
            }}
            className="mt-1 rounded-xl"
          />
          {nameError ? <p className="mt-1 text-xs text-destructive">{nameError}</p> : null}
        </div>
        <div>
          <Label htmlFor="bp-logo">Logo</Label>
          <div className="mt-1 flex items-center gap-3">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted/30">
              {shownLogo ? (
                <img src={shownLogo} alt="Business logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Input
                id="bp-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={saving}
                onChange={onPickLogo}
                className="rounded-xl"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {logoFile ? `Selected: ${logoFile.name}` : "PNG, JPG, WEBP or SVG · max 10 MB"}
              </p>
            </div>
          </div>
          {logoError ? <p className="mt-1 text-xs text-destructive">{logoError}</p> : null}
        </div>
        <div>
          <Label htmlFor="bp-email">Email</Label>
          <Input
            id="bp-email"
            value={profile.email || user?.email || ""}
            readOnly
            disabled
            className="mt-1 rounded-xl"
          />
        </div>
        <Button type="submit" className="rounded-xl" disabled={!dirty || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save Business"}
        </Button>
      </div>
    </form>
  );
}
