import { useState, type FormEvent } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ManagerPermissions } from "@/components/app/manager-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createManager,
  hasManagerFormErrors,
  mapCreateManagerError,
  validateManagerForm,
  type ManagerFormErrors,
} from "@/lib/api/managers";
import { withAuthRetry } from "@/lib/api/with-auth";

const EMPTY_ERRORS: ManagerFormErrors = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function ManagerCreateForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<ManagerFormErrors>(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setCountryCode("+91");
    setPhone("");
    setPermissions([]);
    setErrors(EMPTY_ERRORS);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const values = { name, email, countryCode, phone, permissions };
    const clientErrors = validateManagerForm(values);
    setErrors(clientErrors);
    if (hasManagerFormErrors(clientErrors)) return;

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      country_code: countryCode.trim(),
      phone_number: phone.replace(/[\s-]/g, ""),
      permissions,
    };

    setSubmitting(true);
    try {
      const created = await withAuthRetry((token) => createManager(token, payload));
      if (created.invite_sent) {
        toast.success(
          `Manager created. A temporary password has been emailed to ${created.email}.`,
        );
      } else {
        toast.warning("Manager created, but the email could not be sent.");
      }
      reset();
      onCreated?.();
    } catch (err) {
      const mapped = mapCreateManagerError(err);
      setErrors(mapped);
      if (mapped.general) toast.error(mapped.general);
    } finally {
      setSubmitting(false);
    }
  };

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
          <div>
            <h2 className="text-base font-semibold">Permissions</h2>
            <p className="text-xs text-muted-foreground">
              Applies to all businesses. Manage includes View.
            </p>
          </div>
          <ManagerPermissions idPrefix="perm" value={permissions} onChange={setPermissions} />
          <FieldError message={errors.permissions} />
        </section>

        {errors.general && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errors.general}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting} className="rounded-xl">
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
