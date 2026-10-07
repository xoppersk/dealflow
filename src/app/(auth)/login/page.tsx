/**
 * /login — public sign-in. Centered AuthCard: brand mark + "Dealflow" +
 * "Sell in the open.", email/password fields, "Sign in" primary, "Send me a
 * magic link" secondary, inline error region. Preserves ?next= deep links;
 * ?deactivated=1 shows the deactivation notice. Signed-in users bounce to
 * ?next= or /.
 */

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { signInWithMagicLink, signInWithPassword } from "@/lib/actions/auth";
import { BrandMark } from "@/components/shell/brand-mark";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_S = 30;

type Mode = "form" | "magic-sent";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const deactivated = searchParams.get("deactivated") === "1";

  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<Mode>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Already signed in → bounce to the deep link or dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        router.replace(next);
      } else {
        setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Magic-link resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = emailValid && password.length > 0 && !busy;

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.ok) {
      router.push(next);
      router.refresh();
    } else {
      setError(result.error);
      passwordRef.current?.focus();
    }
  }

  async function handleMagicLink() {
    if (!emailValid || busy) return;
    setBusy(true);
    setError(null);
    const result = await signInWithMagicLink({ email: email.trim(), next });
    setBusy(false);
    if (result.ok) {
      setMode("magic-sent");
      setCooldown(RESEND_COOLDOWN_S);
    } else {
      setError(result.error);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-muted/60 to-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-muted/60 to-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <BrandMark size={44} />
        <p className="mt-1 text-lg text-muted-foreground">Sell in the open.</p>
      </div>

      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        </CardHeader>
        <CardContent>
          {mode === "magic-sent" ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a sign-in link to {email.trim()}.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={handleMagicLink}
                disabled={busy || cooldown > 0}
                className="h-11 min-h-[44px]"
              >
                {cooldown > 0 ? `Resend link (${cooldown}s)` : "Resend link"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("form")}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Use a password instead
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4" noValidate={false}>
              {deactivated && (
                <Alert variant="destructive">
                  <AlertDescription>Your account was deactivated</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive" role="alert" aria-live="assertive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                    className="h-11 pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="h-11 w-full min-h-[44px]" disabled={!canSubmit}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full min-h-[44px]"
                onClick={handleMagicLink}
                disabled={!emailValid || busy}
              >
                Send me a magic link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Need access? Ask your workspace admin.
      </p>
    </main>
  );
}
