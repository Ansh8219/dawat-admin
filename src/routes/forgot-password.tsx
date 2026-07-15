import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAuthenticated, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Forgot password — Daawat Baker's" }] }),
});

function ForgotPasswordPage() {
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    window.setTimeout(() => {
      const result = requestPasswordReset(email);
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    }, 400);
  };

  return (
    <AuthShell
      title={sent ? "Check your email" : "Forgot password"}
      subtitle={
        sent
          ? `If an account exists for ${email.trim()}, you’ll receive reset instructions shortly.`
          : "Enter your admin email and we’ll send a password reset link."
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
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            Didn’t get the email? Check spam, or try again with a different address.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
          >
            Send another link
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="you@daawat.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
