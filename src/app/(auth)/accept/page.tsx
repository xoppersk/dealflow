/**
 * /accept?token=… — invite set-password variant. Reads the invite token
 * from the URL, collects name + password (≥ 8 characters), calls
 * acceptInvite, then redirects to /.
 */

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/actions/auth";
import { BrandMark } from "@/components/shell/brand-mark";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordValid = password.length >= 8;
  const canSubmit = token != null && name.trim().length > 0 && passwordValid && !busy;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !token) return;
    setBusy(true);
    setError(null);
    const result = await acceptInvite({ token, name: name.trim(), password });
    if (result.ok) {
      router.push("/");
      router.refresh();
    } else {
      setBusy(false);
      setError(result.error);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-muted/60 to-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <BrandMark size={44} />
        <p className="mt-1 text-lg text-muted-foreground">Sell in the open.</p>
      </div>

      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight">Join your team</h1>
          <p className="text-sm text-muted-foreground">
            Set your name and password to finish accepting your invite.
          </p>
        </CardHeader>
        <CardContent>
          {!token ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                This invite link is invalid or has expired. Ask your workspace
                admin to send a new one.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" role="alert" aria-live="assertive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  placeholder="Your full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                    className="h-11 pr-12"
                    aria-describedby="password-hint"
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
                <p id="password-hint" className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>

              <Button type="submit" className="h-11 w-full min-h-[44px]" disabled={!canSubmit}>
                {busy ? "Creating account…" : "Create password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
