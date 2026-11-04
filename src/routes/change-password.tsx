import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Lock, LogOut } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/api/auth";
import { apiFieldErrors } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { canCheckPersistedAuth, isAuthenticated, mustChangePassword, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/change-password")({
  beforeLoad: () => {
    if (!canCheckPersistedAuth()) return;
    if (!isAuthenticated()) throw redirect({ to: "/login" });
    // Only reachable while a temporary password is active.
    if (!mustChangePassword()) throw redirect({ to: "/select-panel" });
  },
  component: ChangePasswordPage,
  head: () => ({ meta: [{ title: "Change your password — Daawat Baker's" }] }),
});

type Field = "old_password" | "password" | "password_confirm";
type Errors = Partial<Record<Field | "general", string>>;

function ChangePasswordPage() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!oldPassword) next.old_password = "Enter your temporary password.";
    if (password.length < 8) next.password = "New password must be at least 8 characters.";
    else if (password === oldPassword) {
      next.password = "The new password must be different from the current one.";
    }
    if (passwordConfirm !== password) next.password_confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await withAuthRetry((token) => changePassword(token, oldPassword, password, passwordConfirm));
      // Same tokens keep working — no re-login.
      useAuth.getState().markPasswordChanged();
      await useAuth.getState().loadAccess();
      void navigate({ to: "/select-panel" });
    } catch (err) {
      const fields = apiFieldErrors(err);
      const mapped: Errors = {};
      for (const f of ["old_password", "password", "password_confirm"] as const) {
        if (fields[f]) mapped[f] = fields[f];
      }
      if (Object.keys(mapped).length === 0) {
        mapped.general =
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      }
      setErrors(mapped);
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    logout();
    void navigate({ to: "/login" });
  };

  const input = (
    id: Field,
    label: string,
    value: string,
    set: (v: string) => void,
    autoComplete: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => set(e.target.value)}
          aria-invalid={Boolean(errors[id])}
          className="rounded-xl pl-9 pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={show ? "Hide passwords" : "Show passwords"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {errors[id] && <p className="text-xs text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <AuthShell
      badge="Security"
      title="Change your password"
      subtitle="You are using a temporary password. Please set a new password to continue."
      footer={
        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.general && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errors.general}
          </div>
        )}
        {input(
          "old_password",
          "Current (temporary) password",
          oldPassword,
          setOldPassword,
          "current-password",
        )}
        {input("password", "New password", password, setPassword, "new-password")}
        {input(
          "password_confirm",
          "Confirm new password",
          passwordConfirm,
          setPasswordConfirm,
          "new-password",
        )}
        <Button type="submit" className="w-full rounded-xl" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
            </>
          ) : (
            "Set new password"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
