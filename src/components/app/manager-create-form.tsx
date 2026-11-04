import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ManagerPermissions } from "@/components/app/manager-permissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listBusinesses } from "@/lib/api/businesses";
import {
  createManager,
  hasManagerFormErrors,
  mapCreateManagerError,
  validateManagerForm,
  type ManagerFormErrors,
} from "@/lib/api/managers";
import { ApiError, type Business } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";

const EMPTY_ERRORS: ManagerFormErrors = { assignments: {} };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function ManagerCreateForm({ onCreated }: { onCreated?: () => void }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [bizError, setBizError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  /** business public_id -> permissions. Insertion order = selection order. */
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<ManagerFormErrors>(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);

  const loadBusinesses = useCallback(async () => {
    setLoadingBiz(true);
    setBizError("");
    try {
      setBusinesses(await withAuthRetry((token) => listBusinesses(token)));
    } catch (err) {
      setBizError(err instanceof ApiError ? err.message : "Unable to load businesses.");
    } finally {
      setLoadingBiz(false);
    }
  }, []);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  const toggleBusiness = (id: string, checked: boolean) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (checked) next[id] ??= [];
      else delete next[id];
      return next;
    });
  };

  const reset = () => {
    setName("");
    setEmail("");
    setCountryCode("+91");
    setPhone("");
    setAssignments({});
    setErrors(EMPTY_ERRORS);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const values = { name, email, countryCode, phone, assignments };
    const clientErrors = validateManagerForm(values);
    setErrors(clientErrors);
    if (hasManagerFormErrors(clientErrors)) return;

    const businessIds = Object.keys(assignments);
    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      country_code: countryCode.trim(),
      phone_number: phone.replace(/[\s-]/g, ""),
      assignments: businessIds.map((id) => ({
        business_id: id,
        permissions: assignments[id],
      })),
    };

    setSubmitting(true);
    try {
      const created = await withAuthRetry((token) => createManager(token, payload));
      if (created.invite_sent) {
        toast.success(`Invite email sent to ${created.email}`);
      } else {
        toast.warning("Manager created, but the invite email could not be sent.");
      }
      reset();
      onCreated?.();
    } catch (err) {
      const mapped = mapCreateManagerError(err, businessIds);
      setErrors(mapped);
      if (mapped.general) toast.error(mapped.general);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBusinesses = businesses.filter((b) => b.public_id in assignments);

  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold">Details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="mgr-name">Name</Label>
            <Input
              id="mgr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
            />
            <FieldError message={errors.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mgr-email">Email</Label>
            <Input
              id="mgr-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
            />
            <FieldError message={errors.email} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mgr-phone">Phone</Label>
            <div className="flex gap-2">
              <Input
                aria-label="Country code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-20 shrink-0"
                inputMode="tel"
                aria-invalid={Boolean(errors.country_code)}
              />
              <Input
                id="mgr-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="off"
                aria-invalid={Boolean(errors.phone_number)}
              />
            </div>
            <FieldError message={errors.country_code} />
            <FieldError message={errors.phone_number} />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Businesses</h2>
            {bizError && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void loadBusinesses()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            )}
          </div>

          {loadingBiz ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading businesses…
            </div>
          ) : bizError ? (
            <p role="alert" className="text-sm text-destructive">
              {bizError}
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {businesses.map((b) => (
                <li key={b.public_id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 hover:bg-muted/40">
                    <Checkbox
                      checked={b.public_id in assignments}
                      onCheckedChange={(c) => toggleBusiness(b.public_id, c === true)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{b.name}</span>
                      <span className="block text-xs capitalize text-muted-foreground">
                        {b.type.replace(/_/g, " ")}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <FieldError message={errors.businesses} />
        </section>

        {selectedBusinesses.map((b) => (
          <section
            key={b.public_id}
            className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 sm:p-5"
          >
            <div>
              <h2 className="text-base font-semibold">Permissions — {b.name}</h2>
              <p className="text-xs capitalize text-muted-foreground">
                {b.type.replace(/_/g, " ")}
              </p>
            </div>
            <ManagerPermissions
              idPrefix={`perm-${b.public_id}`}
              value={assignments[b.public_id] ?? []}
              onChange={(next) => setAssignments((prev) => ({ ...prev, [b.public_id]: next }))}
            />
            <FieldError message={errors.assignments[b.public_id]} />
          </section>
        ))}

        {errors.general && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errors.general}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || loadingBiz} className="rounded-xl">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" /> Create manager
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
