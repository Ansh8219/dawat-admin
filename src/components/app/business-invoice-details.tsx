import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getBusinessInvoiceDetails,
  listBusinesses,
  updateBusinessInvoiceDetails,
} from "@/lib/api/businesses";
import { apiFieldErrors } from "@/lib/api/client";
import {
  invoiceDetailsToForm,
  invoiceFieldLabel,
  invoiceFormToPayload,
  validateInvoiceDetails,
  type InvoiceDetailsField,
  type InvoiceDetailsForm,
} from "@/lib/api/invoices";
import { ApiError } from "@/lib/api/types";
import type { Business, BusinessInvoiceDetails } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

/** Only food businesses issue GST invoices. */
const INVOICE_BUSINESS_TYPES = new Set(["restaurant", "bakery"]);

type Row = {
  business: Business;
  details: BusinessInvoiceDetails | null;
  error: string;
};

function sortRows(a: Row, b: Row): number {
  const rank = (t: string) => (t === "restaurant" ? 0 : t === "bakery" ? 1 : 2);
  return (
    rank(a.business.type) - rank(b.business.type) || a.business.name.localeCompare(b.business.name)
  );
}

export function BusinessInvoiceDetailsPanel() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const businesses = (await withAuthRetry((token) => listBusinesses(token))).filter((b) =>
        INVOICE_BUSINESS_TYPES.has(b.type),
      );
      const settled = await Promise.allSettled(
        businesses.map((b) =>
          withAuthRetry((token) => getBusinessInvoiceDetails(token, b.public_id)),
        ),
      );
      setRows(
        businesses
          .map((business, i) => {
            const result = settled[i];
            return result.status === "fulfilled"
              ? { business, details: result.value, error: "" }
              : {
                  business,
                  details: null,
                  error:
                    result.reason instanceof ApiError
                      ? result.reason.message
                      : "Unable to load invoice details.",
                };
          })
          .sort(sortRows),
      );
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load businesses.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSaved(details: BusinessInvoiceDetails) {
    setRows((prev) =>
      prev.map((row) =>
        row.business.public_id === details.public_id ? { ...row, details, error: "" } : row,
      ),
    );
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="text-sm">
            <div className="font-semibold">GST invoice details</div>
            <p className="mt-0.5 text-muted-foreground">
              A tax invoice is created automatically when a food order completes, one per business
              with its own GSTIN and number series. Until a business's details are filled in, its
              orders still complete but no invoice is issued.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading businesses…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No restaurant or bakery businesses found.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <BusinessCard key={row.business.public_id} row={row} onEdit={() => setEditing(row)} />
          ))}
        </div>
      )}

      <InvoiceDetailsDialog row={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
    </div>
  );
}

function BusinessCard({ row, onEdit }: { row: Row; onEdit: () => void }) {
  const { business, details, error } = row;
  const ready = details?.is_invoice_ready ?? false;
  const missing = details?.missing_fields ?? [];

  return (
    <div className="card-elevated flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{business.name}</div>
          <div className="text-xs capitalize text-muted-foreground">
            {business.type.replace(/_/g, " ")}
          </div>
        </div>
        {details &&
          (ready ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              <CheckCircle2 className="h-3 w-3" /> Invoicing on
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
              <AlertTriangle className="h-3 w-3" /> Details missing
            </span>
          ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : details ? (
        <>
          {!ready && missing.length > 0 && (
            <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              No invoices are issued until these are filled:{" "}
              <b>{missing.map(invoiceFieldLabel).join(", ")}</b>
            </p>
          )}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Legal name</dt>
            <dd className="truncate">{details.legal_name || "—"}</dd>
            <dt className="text-muted-foreground">GSTIN</dt>
            <dd className="font-mono">{details.gst_number || "—"}</dd>
            <dt className="text-muted-foreground">State</dt>
            <dd>
              {details.state
                ? `${details.state}${details.state_code ? ` (${details.state_code})` : ""}`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">FSSAI</dt>
            <dd className="font-mono">{details.fssai_number || "—"}</dd>
            <dt className="text-muted-foreground">Invoice prefix</dt>
            <dd className="font-mono">
              {details.invoice_prefix ? `${details.invoice_prefix}/YY-YY/000001` : "—"}
            </dd>
          </dl>
        </>
      ) : null}

      <div className="mt-auto pt-4">
        <Button
          variant={ready ? "outline" : "default"}
          className="gap-2 rounded-xl"
          disabled={!details}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" /> Invoice details
        </Button>
      </div>
    </div>
  );
}

const CONFLICT_FIELD: Record<string, InvoiceDetailsField> = {
  invoice_prefix_locked: "invoice_prefix",
  invoice_prefix_taken: "invoice_prefix",
  gst_number_taken: "gst_number",
};

function InvoiceDetailsDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: (details: BusinessInvoiceDetails) => void;
}) {
  const [form, setForm] = useState<InvoiceDetailsForm>(() => invoiceDetailsToForm(null));
  const [errors, setErrors] = useState<Partial<Record<InvoiceDetailsField, string>>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setForm(invoiceDetailsToForm(row.details));
    setErrors({});
    setFormError("");
  }, [row]);

  function setField(field: InvoiceDetailsField, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // State code is the GSTIN's first 2 digits: fill it in while it's empty or still in sync.
      if (field === "gst_number") {
        const prevCode = prev.gst_number.slice(0, 2);
        const code = value.slice(0, 2);
        if (/^\d{2}$/.test(code) && (!prev.state_code || prev.state_code === prevCode)) {
          next.state_code = code;
        }
      }
      return next;
    });
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    const payload = invoiceFormToPayload(form);
    const clientErrors = validateInvoiceDetails(payload);
    setErrors(clientErrors);
    setFormError("");
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      const saved = await withAuthRetry((token) =>
        updateBusinessInvoiceDetails(token, row.business.public_id, payload),
      );
      toast.success(
        saved.is_invoice_ready
          ? `${saved.name}: invoicing is on`
          : `${saved.name}: invoice details saved`,
      );
      onSaved(saved);
    } catch (err) {
      const fieldErrors = apiFieldErrors(err) as Partial<Record<InvoiceDetailsField, string>>;
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        const unknown = Object.keys(fieldErrors).filter((k) => !(k in form));
        if (unknown.length)
          setFormError(
            unknown.map((k) => `${k}: ${fieldErrors[k as InvoiceDetailsField]}`).join(" "),
          );
      } else if (err instanceof ApiError && CONFLICT_FIELD[err.code]) {
        setErrors({ [CONFLICT_FIELD[err.code]]: err.message });
      } else {
        setFormError(err instanceof ApiError ? err.message : "Unable to save invoice details.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoice details · {row?.business.name}</DialogTitle>
          <DialogDescription>
            Printed on every tax invoice this business issues. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={(e) => void onSubmit(e)} noValidate>
          <FormField
            label="Legal name"
            error={errors.legal_name}
            hint="As on the GST registration."
          >
            <Input
              value={form.legal_name}
              maxLength={255}
              onChange={(e) => setField("legal_name", e.target.value)}
              placeholder="Dawat Foods Pvt Ltd"
              className="rounded-xl"
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <FormField label="GSTIN" error={errors.gst_number}>
              <Input
                value={form.gst_number}
                maxLength={15}
                onChange={(e) =>
                  setField("gst_number", e.target.value.toUpperCase().replace(/\s/g, ""))
                }
                placeholder="03AAACD1234E1Z5"
                className="rounded-xl font-mono uppercase"
              />
            </FormField>
            <FormField label="State code" error={errors.state_code}>
              <Input
                value={form.state_code}
                inputMode="numeric"
                maxLength={2}
                onChange={(e) => setField("state_code", e.target.value.replace(/\D/g, ""))}
                placeholder="03"
                className="rounded-xl font-mono"
              />
            </FormField>
          </div>

          <FormField label="State" error={errors.state}>
            <Input
              value={form.state}
              maxLength={64}
              onChange={(e) => setField("state", e.target.value)}
              placeholder="Punjab"
              className="rounded-xl"
            />
          </FormField>

          <FormField label="Address" error={errors.address} hint="Registered place of business.">
            <Textarea
              value={form.address}
              maxLength={500}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="Main Road, Rajpura"
              className="min-h-20 rounded-xl"
            />
          </FormField>

          <FormField label="FSSAI number" error={errors.fssai_number}>
            <Input
              value={form.fssai_number}
              inputMode="numeric"
              maxLength={14}
              onChange={(e) => setField("fssai_number", e.target.value.replace(/\D/g, ""))}
              placeholder="12345678901234"
              className="rounded-xl font-mono"
            />
          </FormField>

          <FormField
            label="Invoice prefix"
            error={errors.invoice_prefix}
            hint={
              <>
                2–6 letters, used in invoice numbers like{" "}
                <span className="font-mono">{form.invoice_prefix || "RST"}/26-27/000001</span>.{" "}
                <b>It can't be changed once invoices have been issued.</b>
              </>
            }
          >
            <Input
              value={form.invoice_prefix}
              maxLength={6}
              onChange={(e) =>
                setField("invoice_prefix", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              placeholder="RST"
              className="w-32 rounded-xl font-mono uppercase"
            />
          </FormField>

          {formError && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="gap-2 rounded-xl" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save details"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className={cn("text-sm", error && "text-destructive")}>{label}</Label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
