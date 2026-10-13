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
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

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
  const [busy, setBusy] = useState<"password" | "magic" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
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

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy !== null) return;
    // The button stays full-strength at rest; an invalid attempt gets an
    // inline hint instead of a silently dead, washed-out button.
    if (!emailValid) {
      setHint("Enter a valid email address to sign in.");
      return;
    }
    if (password.length === 0) {
      setHint("Enter your password to sign in.");
      return;
    }
    setHint(null);
    setBusy("password");
    setError(null);
    const result = await signInWithPassword({ email: email.trim(), password });
    setBusy(null);
    if (result.ok) {
      router.push(next);
      router.refresh();
    } else {
      setError(result.error);
      passwordRef.current?.focus();
    }
  }

  async function handleMagicLink() {
    if (busy !== null) return;
    if (!emailValid) {
      setHint("Enter a valid email address and we'll send you a sign-in link.");
      return;
    }
    setHint(null);
    setBusy("magic");
    setError(null);
    const result = await signInWithMagicLink({ email: email.trim(), next });
    setBusy(null);
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
    <main className="flex min-h-dvh flex-col items-center justify-start bg-gradient-to-b from-muted/60 to-background px-4 pt-[12vh] pb-12 sm:justify-center sm:py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <BrandMark size={44} />
        <p className="font-display mt-1 text-lg text-muted-foreground">Sell in the open.</p>
      </div>

      <Card className="w-full max-w-[400px] rounded-[2px] border-border shadow-none">
        <CardHeader>
          <h1 className="font-display text-xl font-semibold tracking-tight">Sign in</h1>
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
                disabled={busy !== null || cooldown > 0}
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
            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              {deactivated && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Your account was deactivated. Ask your workspace admin to
                    reactivate it.
                  </AlertDescription>
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
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setHint(null);
                  }}
                  disabled={busy !== null}
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
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setHint(null);
                    }}
                    disabled={busy !== null}
                    className="h-11 pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full min-h-[44px] disabled:opacity-100"
                disabled={busy !== null}
              >
                {busy === "password" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full min-h-[44px] disabled:opacity-100"
                onClick={handleMagicLink}
                disabled={busy !== null}
              >
                {busy === "magic" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Sending link…
                  </>
                ) : (
                  "Send me a magic link"
                )}
              </Button>

              {hint && (
                <p className="text-center text-sm text-muted-foreground" role="status">
                  {hint}
                </p>
              )}
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
