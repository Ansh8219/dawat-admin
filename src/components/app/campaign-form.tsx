import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Info, Loader2, Plus, Smartphone, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFieldErrors } from "@/lib/api/client";
import { createCampaign, previewCampaignAudience, updateCampaign } from "@/lib/api/campaigns";
import { listOffers } from "@/lib/api/offers";
import { ApiError } from "@/lib/api/types";
import type {
  Campaign,
  CampaignAudienceType,
  CampaignChannel,
  CampaignOfferRef,
  CampaignPayload,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import {
  AUDIENCE_OPTIONS,
  CHANNEL_LABELS,
  isoToLocalInput,
  localInputToIso,
  renderPlaceholders,
} from "@/lib/campaigns";
import { cn } from "@/lib/utils";

const MAX_PARAMS = 10;
const NO_OFFER = "__none__";

type FormState = {
  name: string;
  title: string;
  body: string;
  offer_id: string;
  audience_type: CampaignAudienceType;
  audience_days: string;
  channels: CampaignChannel[];
  whatsapp_template_name: string;
  whatsapp_template_language: string;
  whatsapp_template_params: string[];
  mode: "now" | "schedule";
  scheduled_at: string;
};

function initialState(c?: Campaign): FormState {
  if (!c) {
    return {
      name: "",
      title: "",
      body: "",
      offer_id: "",
      audience_type: "all_customers",
      audience_days: "30",
      channels: ["push"],
      whatsapp_template_name: "",
      whatsapp_template_language: "en",
      whatsapp_template_params: [],
      mode: "now",
      scheduled_at: "",
    };
  }
  return {
    name: c.name,
    title: c.title,
    body: c.body,
    offer_id: c.offer?.id ?? "",
    audience_type: c.audience_type,
    audience_days: c.audience_days != null ? String(c.audience_days) : "30",
    channels: c.channels,
    whatsapp_template_name: c.whatsapp_template_name ?? "",
    whatsapp_template_language: c.whatsapp_template_language || "en",
    whatsapp_template_params: c.whatsapp_template_params ?? [],
    mode: "schedule",
    scheduled_at: isoToLocalInput(c.scheduled_at),
  };
}

type OfferOption = CampaignOfferRef;

export function CampaignForm({
  campaign,
  onStale,
}: {
  /** When set, the form edits this (scheduled) campaign with a full PATCH. */
  campaign?: Campaign;
  /** Called on 409 `campaign_not_editable` so the caller can refresh. */
  onStale?: () => void;
}) {
  const navigate = useNavigate();
  const editing = Boolean(campaign);
  const [form, setForm] = useState<FormState>(() => initialState(campaign));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingImage = removeImage ? null : (campaign?.image_url ?? null);
  const previewImage = blobUrl ?? existingImage;

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  function onPickImage(file: File | null) {
    if (file && !file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    setBlobUrl(file ? URL.createObjectURL(file) : null);
    if (file) setRemoveImage(false);
    setErrors((e) => (e.image ? { ...e, image: "" } : e));
  }

  function onRemoveImage() {
    onPickImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setRemoveImage(Boolean(campaign?.image_url));
  }
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState("");

  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  // Offers for the picker (public id is what the campaign API expects).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await withAuthRetry((t) => listOffers(t, { page_size: 100 }));
        if (cancelled) return;
        setOffers(data.results.map((o) => ({ id: o.public_id, code: o.code, title: o.title })));
      } catch (err) {
        if (!cancelled) {
          setOffersError(err instanceof ApiError ? err.message : "Unable to load offers.");
        }
      } finally {
        if (!cancelled) setOffersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the linked offer selectable even if it is not in the first page of offers.
  const offerOptions = useMemo(() => {
    if (campaign?.offer && !offers.some((o) => o.id === campaign.offer!.id)) {
      return [campaign.offer, ...offers];
    }
    return offers;
  }, [offers, campaign]);
  const selectedOffer = offerOptions.find((o) => o.id === form.offer_id) ?? null;

  const audienceOpt = AUDIENCE_OPTIONS.find((o) => o.value === form.audience_type)!;
  const daysNum = Number(form.audience_days);
  const daysValid = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 3650;
  const audienceReady = !audienceOpt.needsDays || daysValid;

  // Debounced audience preview whenever audience fields change.
  useEffect(() => {
    if (!audienceReady) {
      setAudienceCount(null);
      setAudienceError("");
      return;
    }
    const ctrl = new AbortController();
    setAudienceLoading(true);
    setAudienceError("");
    const timer = window.setTimeout(async () => {
      try {
        const data = await withAuthRetry((t) =>
          previewCampaignAudience(
            t,
            {
              audience_type: form.audience_type,
              ...(audienceOpt.needsDays ? { audience_days: daysNum } : {}),
            },
            ctrl.signal,
          ),
        );
        setAudienceCount(data.eligible_customers);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setAudienceCount(null);
        setAudienceError(err instanceof ApiError ? err.message : "Unable to estimate audience.");
      } finally {
        if (!ctrl.signal.aborted) setAudienceLoading(false);
      }
    }, 500);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [form.audience_type, daysNum, audienceReady, audienceOpt.needsDays]);

  const hasWhatsapp = form.channels.includes("whatsapp");

  function toggleChannel(ch: CampaignChannel) {
    set(
      "channels",
      form.channels.includes(ch) ? form.channels.filter((c) => c !== ch) : [...form.channels, ch],
    );
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    else if (form.name.length > 255) e.name = "Max 255 characters";
    if (!form.title.trim()) e.title = "Title is required";
    else if (form.title.length > 255) e.title = "Max 255 characters";
    if (!form.body.trim()) e.body = "Message is required";
    else if (form.body.length > 2000) e.body = "Max 2000 characters";
    if (audienceOpt.needsDays && !daysValid)
      e.audience_days = "Enter a whole number from 1 to 3650";
    if (form.channels.length === 0) e.channels = "Select at least one channel";
    if (hasWhatsapp) {
      if (!form.whatsapp_template_name.trim()) {
        e.whatsapp_template_name = "Template name is required for WhatsApp";
      }
      if (form.whatsapp_template_params.length > MAX_PARAMS) {
        e.whatsapp_template_params = `Max ${MAX_PARAMS} parameters`;
      }
    }
    if (form.mode === "schedule") {
      const iso = localInputToIso(form.scheduled_at);
      if (!iso) e.scheduled_at = "Pick a date and time";
      else if (new Date(iso).getTime() <= Date.now()) e.scheduled_at = "Must be in the future";
    }
    return e;
  }

  function buildPayload(): CampaignPayload {
    const payload: CampaignPayload = {
      name: form.name.trim(),
      title: form.title.trim(),
      body: form.body.trim(),
      audience_type: form.audience_type,
      channels: form.channels,
    };
    if (removeImage && !imageFile) payload.remove_image = true;
    if (form.offer_id) payload.offer_id = form.offer_id;
    if (audienceOpt.needsDays) payload.audience_days = daysNum;
    if (hasWhatsapp) {
      payload.whatsapp_template_name = form.whatsapp_template_name.trim();
      payload.whatsapp_template_language = form.whatsapp_template_language.trim() || "en";
      payload.whatsapp_template_params = form.whatsapp_template_params.map((p) => p.trim());
    }
    if (form.mode === "schedule") {
      const iso = localInputToIso(form.scheduled_at);
      if (iso) payload.scheduled_at = iso;
    }
    return payload;
  }

  function onSubmit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (form.mode === "now") {
      setConfirmOpen(true);
      return;
    }
    void submit();
  }

  async function submit() {
    setConfirmOpen(false);
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = await withAuthRetry((t) =>
        campaign
          ? updateCampaign(t, campaign.id, payload, imageFile)
          : createCampaign(t, payload, imageFile),
      );
      toast.success(
        campaign
          ? "Campaign updated"
          : form.mode === "now"
            ? "Campaign created — sending shortly"
            : "Campaign scheduled",
      );
      void navigate({ to: "/campaigns/$campaignId", params: { campaignId: saved.id } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      if (err instanceof ApiError && err.code === "campaign_not_editable") {
        toast.error(
          err.message || "This campaign has already started and can no longer be edited.",
        );
        onStale?.();
        return;
      }
      const fieldErrors = apiFieldErrors(err);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      if (err instanceof ApiError && err.code === "offer_not_found") {
        setErrors((x) => ({ ...x, offer_id: "Offer not found" }));
      }
      toast.error(err instanceof ApiError ? err.message : "Unable to save campaign.");
    } finally {
      setSaving(false);
    }
  }

  const previewTitle = renderPlaceholders(form.title, selectedOffer) || "Notification title";
  const previewBody = renderPlaceholders(form.body, selectedOffer) || "Your message appears here.";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Section title="Message">
          <Field label="Internal name" error={errors.name} htmlFor="c-name">
            <Input
              id="c-name"
              value={form.name}
              maxLength={255}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Weekend biryani promo"
              className="rounded-xl"
            />
            <Hint>Only visible to admins.</Hint>
          </Field>
          <Field label="Push title" error={errors.title} htmlFor="c-title">
            <Input
              id="c-title"
              value={form.title}
              maxLength={255}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Hi {name}, weekend offer!"
              className="rounded-xl"
            />
          </Field>
          <Field label="Message" error={errors.body} htmlFor="c-body">
            <Textarea
              id="c-body"
              value={form.body}
              maxLength={2000}
              onChange={(e) => set("body", e.target.value)}
              placeholder="Use {offer_code} for {offer_title}"
              className="min-h-[96px] rounded-xl"
            />
            <Hint>
              Placeholders: <code>{"{name}"}</code>, <code>{"{offer_title}"}</code>,{" "}
              <code>{"{offer_code}"}</code> (offer ones are empty without a linked offer).{" "}
              {form.body.length}/2000
            </Hint>
          </Field>
          <Field label="Image (optional)" error={errors.image} htmlFor="c-image">
            <div className="flex items-center gap-3">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Campaign"
                  className="h-16 w-16 rounded-xl border border-border object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewImage ? "Replace image" : "Upload image"}
                </Button>
                {previewImage && (
                  <Button type="button" variant="ghost" size="sm" onClick={onRemoveImage}>
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                id="c-image"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
            </div>
            <Hint>
              Used as the WhatsApp header image — set it only if the approved template has an image
              header.
            </Hint>
          </Field>
          <Field label="Linked offer (optional)" error={errors.offer_id}>
            <Select
              value={form.offer_id || NO_OFFER}
              onValueChange={(v) => set("offer_id", v === NO_OFFER ? "" : v)}
              disabled={offersLoading}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={offersLoading ? "Loading offers…" : "No offer"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_OFFER}>No offer</SelectItem>
                {offerOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.code} — {o.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {offersError && <p className="mt-1 text-xs text-destructive">{offersError}</p>}
          </Field>
        </Section>

        <Section title="Audience">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who should receive it?" error={errors.audience_type}>
              <Select
                value={form.audience_type}
                onValueChange={(v) => set("audience_type", v as CampaignAudienceType)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {audienceOpt.needsDays && (
              <Field label="Days" error={errors.audience_days} htmlFor="c-days">
                <Input
                  id="c-days"
                  type="number"
                  min={1}
                  max={3650}
                  value={form.audience_days}
                  onChange={(e) => set("audience_days", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
            )}
          </div>
          <Hint>{audienceOpt.help}</Hint>
          <div
            className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm"
            aria-live="polite"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            {!audienceReady ? (
              <span className="text-muted-foreground">Enter the number of days to estimate.</span>
            ) : audienceLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Estimating audience…
              </span>
            ) : audienceError ? (
              <span className="text-destructive">{audienceError}</span>
            ) : audienceCount != null ? (
              <span>
                ~
                <span className="font-semibold tabular-nums">{audienceCount.toLocaleString()}</span>{" "}
                customers will be targeted
              </span>
            ) : null}
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Each customer receives at most one campaign per rolling 24 hours, so customers who got a
            campaign in the last 24h are skipped and the real number sent can be lower.
          </p>
        </Section>

        <Section title="Channels">
          <div className="flex flex-wrap gap-4">
            {(["push", "whatsapp"] as CampaignChannel[]).map((ch) => (
              <label key={ch} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.channels.includes(ch)}
                  onCheckedChange={() => toggleChannel(ch)}
                />
                {CHANNEL_LABELS[ch]}
              </label>
            ))}
          </div>
          {errors.channels && <p className="text-xs text-destructive">{errors.channels}</p>}

          {hasWhatsapp && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <div className="text-sm font-medium">WhatsApp template</div>
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <Field label="Template name" error={errors.whatsapp_template_name} htmlFor="c-tpl">
                  <Input
                    id="c-tpl"
                    value={form.whatsapp_template_name}
                    onChange={(e) => set("whatsapp_template_name", e.target.value)}
                    placeholder="promo_offer"
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Language" error={errors.whatsapp_template_language} htmlFor="c-lang">
                  <Input
                    id="c-lang"
                    value={form.whatsapp_template_language}
                    onChange={(e) => set("whatsapp_template_language", e.target.value)}
                    placeholder="en"
                    className="rounded-xl"
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>Template parameters</Label>
                <Hint>
                  Filled into {"{{1}}"}, {"{{2}}"}… in order. Placeholders are supported.
                </Hint>
                {form.whatsapp_template_params.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                    <Input
                      value={p}
                      aria-label={`Parameter ${i + 1}`}
                      onChange={(e) =>
                        set(
                          "whatsapp_template_params",
                          form.whatsapp_template_params.map((x, j) =>
                            j === i ? e.target.value : x,
                          ),
                        )
                      }
                      placeholder="{name}"
                      className="rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove parameter ${i + 1}`}
                      onClick={() =>
                        set(
                          "whatsapp_template_params",
                          form.whatsapp_template_params.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {errors.whatsapp_template_params && (
                  <p className="text-xs text-destructive">{errors.whatsapp_template_params}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.whatsapp_template_params.length >= MAX_PARAMS}
                  onClick={() =>
                    set("whatsapp_template_params", [...form.whatsapp_template_params, ""])
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add parameter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                WhatsApp deliveries show as skipped (“WhatsApp account not connected yet”) until the
                business WhatsApp account is connected. That is expected.
              </p>
            </div>
          )}
        </Section>

        <Section title="When to send">
          <div className="inline-flex rounded-xl border border-border p-1" role="radiogroup">
            {(
              [
                ["now", "Send now"],
                ["schedule", "Schedule"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.mode === value}
                onClick={() => set("mode", value)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  form.mode === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {form.mode === "schedule" ? (
            <Field label="Send at (your local time)" error={errors.scheduled_at} htmlFor="c-at">
              <Input
                id="c-at"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => set("scheduled_at", e.target.value)}
                className="max-w-xs rounded-xl"
              />
              <Hint>Must be in the future.</Hint>
            </Field>
          ) : (
            <Hint>The campaign starts a few seconds after you create it.</Hint>
          )}
        </Section>

        <div className="flex items-center gap-3">
          <Button onClick={onSubmit} disabled={saving} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : form.mode === "now" ? "Send campaign" : "Schedule campaign"}
          </Button>
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() =>
              campaign
                ? void navigate({
                    to: "/campaigns/$campaignId",
                    params: { campaignId: campaign.id },
                  })
                : void navigate({ to: "/campaigns" })
            }
          >
            Cancel
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Smartphone className="h-4 w-4" /> Push preview
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/20" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{previewTitle}</div>
                <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {previewBody}
                </div>
              </div>
            </div>
            {previewImage && (
              <img
                src={previewImage}
                alt=""
                className="mt-3 max-h-40 w-full rounded-xl object-cover"
              />
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sample name “Aisha” is used for {"{name}"}.
          </p>
        </div>
      </aside>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this campaign now?</AlertDialogTitle>
            <AlertDialogDescription>
              {audienceCount != null
                ? `This will message ~${audienceCount.toLocaleString()} customers.`
                : "This will message every customer in the selected audience."}{" "}
              It starts within a few seconds and can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review</AlertDialogCancel>
            <AlertDialogAction onClick={() => void submit()}>Send now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
