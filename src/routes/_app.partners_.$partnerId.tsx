import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatPartnerDate,
  formatPartnerPhone,
  getPartner,
  PARTNER_REJECT_FIELDS,
  partnerStatusLabel,
  reviewPartner,
} from "@/lib/api/partners";
import { ApiError } from "@/lib/api/types";
import type { PartnerDetail, PartnerDocuments, PartnerRejectField } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileImage,
  IdCard,
  Loader2,
  MapPin,
  ShieldAlert,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/partners_/$partnerId")({
  component: PartnerDetailPage,
  head: () => ({ meta: [{ title: "Partner review — Daawat Baker's" }] }),
});

type DocItem = {
  key: string;
  label: string;
  group: string;
  src: string | null | undefined;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function display(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

function buildDocuments(docs: PartnerDocuments): DocItem[] {
  return [
    { key: "aadhaar_front", label: "Aadhaar front", group: "Identity", src: docs.aadhaar_front_url },
    { key: "aadhaar_back", label: "Aadhaar back", group: "Identity", src: docs.aadhaar_back_url },
    { key: "licence_front", label: "Licence front", group: "Licence", src: docs.licence_front_url },
    { key: "licence_back", label: "Licence back", group: "Licence", src: docs.licence_back_url },
    { key: "rc_front", label: "RC front", group: "Vehicle", src: docs.rc_front_url },
    { key: "rc_back", label: "RC back", group: "Vehicle", src: docs.rc_back_url },
    {
      key: "insurance_image",
      label: "Insurance",
      group: "Vehicle",
      src: docs.insurance_image_url,
    },
  ];
}

function PartnerDetailPage() {
  const { partnerId } = Route.useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectedFields, setRejectedFields] = useState<PartnerRejectField[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

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
      const data = await withAuthRetry((token) => getPartner(token, partnerId));
      setPartner(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load partner.");
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, [partnerId, handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  const canReview = partner?.partner_status === "pending";

  const documents = useMemo(
    () => (partner ? buildDocuments(partner.documents) : []),
    [partner],
  );

  const documentGroups = useMemo(() => {
    const groups = new Map<string, DocItem[]>();
    for (const doc of documents) {
      const list = groups.get(doc.group) ?? [];
      list.push(doc);
      groups.set(doc.group, list);
    }
    return [...groups.entries()];
  }, [documents]);

  const fieldGroups = useMemo(() => {
    const groups = new Map<string, typeof PARTNER_REJECT_FIELDS>();
    for (const field of PARTNER_REJECT_FIELDS) {
      const list = groups.get(field.group) ?? [];
      list.push(field);
      groups.set(field.group, list);
    }
    return [...groups.entries()];
  }, []);

  function toggleField(field: PartnerRejectField) {
    setRejectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  }

  async function onApprove() {
    if (!partner) return;
    setSubmitting(true);
    try {
      await withAuthRetry((token) =>
        reviewPartner(token, partner.public_id, { action: "approve" }),
      );
      toast.success(`${partner.profile.full_name || "Partner"} approved`);
      setApproveOpen(false);
      void navigate({ to: "/partners" });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to approve partner");
    } finally {
      setSubmitting(false);
    }
  }

  async function onReject() {
    if (!partner) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Enter a rejection reason");
      return;
    }
    if (rejectedFields.length === 0) {
      toast.error("Select at least one field with issues");
      return;
    }
    setSubmitting(true);
    try {
      await withAuthRetry((token) =>
        reviewPartner(token, partner.public_id, {
          action: "reject",
          reason,
          rejected_fields: rejectedFields,
        }),
      );
      toast.success(`${partner.profile.full_name || "Partner"} rejected`);
      setRejectOpen(false);
      void navigate({ to: "/partners" });
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to reject partner");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title={partner?.profile.full_name || "Partner review"}
        crumbs={["Growth", "Partners", "Review"]}
        description="Check application details on the left. Verify document images on the right."
        action={
          <Button variant="outline" className="rounded-xl gap-2" asChild>
            <Link to="/partners">
              <ArrowLeft className="h-4 w-4" /> Back to list
            </Link>
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading application…</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : partner ? (
          <>
            {/* Summary + actions */}
            <div className="sticky top-0 z-10 rounded-2xl border bg-card/95 p-4 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-card/90">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    {partner.profile.profile_picture_url ? (
                      <AvatarImage
                        src={partner.profile.profile_picture_url}
                        alt={partner.profile.full_name}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-sm text-primary">
                      {initials(partner.profile.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-bold tracking-tight">
                        {display(partner.profile.full_name)}
                      </h2>
                      <StatusBadge status={partnerStatusLabel(partner.partner_status)} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {formatPartnerPhone(partner.user)} · {display(partner.user.email)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Submitted {formatPartnerDate(partner.submitted_at)}
                      {partner.reviewed_at
                        ? ` · Reviewed ${formatPartnerDate(partner.reviewed_at)}`
                        : ""}
                    </p>
                  </div>
                </div>

                {canReview ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setRejectReason("");
                        setRejectedFields([]);
                        setRejectOpen(true);
                      }}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                    <Button className="rounded-xl gap-2" onClick={() => setApproveOpen(true)}>
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Only pending applications can be reviewed.
                  </div>
                )}
              </div>
            </div>

            {partner.partner_status === "rejected" && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-destructive">Rejection details</p>
                    <p className="text-muted-foreground">
                      {partner.rejection_reason || "No reason provided."}
                    </p>
                    {partner.rejected_fields && partner.rejected_fields.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Fields: {partner.rejected_fields.join(", ")}
                      </p>
                    )}
                    {partner.rejected_steps && partner.rejected_steps.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Steps: {partner.rejected_steps.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Details | Documents */}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* Application details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-0.5">
                  <UserRound className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold">Application details</h3>
                </div>

                <DetailCard title="Personal" icon={UserRound}>
                  <Field label="Full name" value={partner.profile.full_name} />
                  <Field label="Email" value={partner.user.email} />
                  <Field label="Phone" value={formatPartnerPhone(partner.user)} />
                  <Field label="Date of birth" value={partner.profile.date_of_birth} />
                  <Field label="Gender" value={partner.profile.gender} />
                  <Field label="Role" value={partner.user.role} />
                </DetailCard>

                <DetailCard title="Address" icon={MapPin}>
                  <Field label="House / flat" value={partner.address.house_flat} />
                  <Field label="Street" value={partner.address.street} />
                  <Field label="City" value={partner.address.city} />
                  <Field label="State" value={partner.address.state} />
                  <Field label="Pincode" value={partner.address.pincode} />
                </DetailCard>

                <DetailCard title="Licence" icon={IdCard}>
                  <Field label="Licence number" value={partner.licence.licence_number} />
                </DetailCard>

                <DetailCard title="Vehicle" icon={FileImage}>
                  <Field label="Type" value={partner.vehicle.vehicle_type} />
                  <Field label="Model" value={partner.vehicle.vehicle_model} />
                  <Field label="Number" value={partner.vehicle.vehicle_number} />
                  <Field label="Color" value={partner.vehicle.color} />
                  <Field label="Insurance expiry" value={partner.vehicle.insurance_expiry_date} />
                </DetailCard>

                <DetailCard title="Bank" icon={Wallet}>
                  <Field label="Account holder" value={partner.bank.account_holder_name} />
                  <Field label="Account number" value={partner.bank.account_number} />
                  <Field label="IFSC" value={partner.bank.ifsc_code} />
                  <Field label="UPI ID" value={partner.bank.upi_id} />
                </DetailCard>
              </div>

              {/* Documents to verify */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold">Documents to verify</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {documents.filter((d) => d.src).length}/{documents.length} uploaded
                  </span>
                </div>

                <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
                  <p className="mb-4 text-xs text-muted-foreground">
                    Open each image with Preview to check clarity before approving.
                  </p>

                  <div className="space-y-5">
                    {documentGroups.map(([group, docs]) => (
                      <div key={group}>
                        <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group}
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {docs.map((doc) => (
                            <DocCard
                              key={doc.key}
                              label={doc.label}
                              src={doc.src}
                              onPreview={() => {
                                if (doc.src) setLightbox({ src: doc.src, label: doc.label });
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this partner?</AlertDialogTitle>
            <AlertDialogDescription>
              {partner?.profile.full_name || "This partner"} will be marked as approved and can
              proceed as a delivery partner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void onApprove();
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving…
                </>
              ) : (
                "Approve"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject application</AlertDialogTitle>
            <AlertDialogDescription>
              Select the exact fields with issues and explain why. The partner can fix and
              resubmit.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Licence front and RC back are unclear."
                className="min-h-20 rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <Label>Rejected fields</Label>
              {fieldGroups.map(([group, fields]) => (
                <div key={group} className="rounded-xl border p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {fields.map((f) => {
                      const checked = rejectedFields.includes(f.value);
                      return (
                        <label
                          key={f.value}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors",
                            checked
                              ? "border-destructive/40 bg-destructive/5"
                              : "border-transparent hover:bg-muted/50",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleField(f.value)}
                          />
                          <span>{f.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void onReject();
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting…
                </>
              ) : (
                "Reject"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.label}
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">{lightbox.label}</span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => setLightbox(null)}
              >
                Close
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-3">
              <img
                src={lightbox.src}
                alt={lightbox.label}
                className="max-h-[78vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof MapPin;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2.5">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="max-w-[65%] break-all text-right font-medium text-foreground">
        {display(value)}
      </span>
    </div>
  );
}

function DocCard({
  label,
  src,
  onPreview,
}: {
  label: string;
  src: string | null | undefined;
  onPreview: () => void;
}) {
  if (!src) {
    return (
      <div className="flex flex-col justify-between rounded-xl border border-dashed bg-muted/20 p-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">Not uploaded</p>
        </div>
        <Button size="sm" variant="outline" className="mt-3 h-8 rounded-lg text-xs" disabled>
          Preview
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="relative aspect-[4/3] bg-muted/40">
        <img src={src} alt={label} className="h-full w-full object-cover" />
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
        <p className="truncate text-sm font-medium">{label}</p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 rounded-lg gap-1.5 text-xs"
          onClick={onPreview}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
      </div>
    </div>
  );
}
