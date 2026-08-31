import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canCheckPersistedAuth, isAuthenticated, useAuth } from "@/lib/auth";
import { z } from "zod";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!canCheckPersistedAuth()) return;
    if (isAuthenticated()) {
      throw redirect({ to: "/select-panel" });
    }
  },
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — Daawat Baker's" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token: tokenFromUrl } = Route.useSearch();
  const resetPassword = useAuth((s) => s.resetPassword);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const token = tokenFromUrl?.trim() ?? "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Reset token is missing. Open the link from your email.");
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword(token, password, passwordConfirm);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Password Reset"
      title={done ? "Password updated" : "Set a new password"}
      subtitle={
        done
          ? "Your password has been reset. You can now sign in."
          : token
            ? "Choose a strong password for your admin account."
            : "This reset link is missing a token. Request a new link from the sign-in page."
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <Button
            type="button"
            className="w-full rounded-xl"
            onClick={() => void navigate({ to: "/login" })}
          >
            Sign in
          </Button>
        </div>
      ) : !token ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Invalid or incomplete reset link.
          </div>
          <Button asChild variant="outline" className="w-full rounded-xl">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl pl-9 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="rounded-xl pl-9"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
              </>
            ) : (
              "Reset password"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
