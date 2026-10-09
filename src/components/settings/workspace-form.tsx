"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { z } from "zod";
import { Toaster, toast } from "sonner";

import { updateWorkspaceSettings } from "@/lib/actions/settings";
import type { WorkspaceSettings } from "@/lib/actions/settings-model";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldError,
  FieldHint,
  FieldLabel,
  Input,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/reports/ui";
import { PageHeader } from "@/components/reports/page-header";

const CURRENCIES = ["USD", "EUR", "GBP", "SLL", "NGN", "GHS", "CAD", "AUD", "JPY", "CHF", "ZAR"];

const FormSchema = z.object({
  workspaceName: z.string().trim().min(1, "Workspace name is required").max(80),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  staleThresholdDays: z.coerce.number().int().min(1, "At least 1 day").max(90, "At most 90 days"),
  digestEnabled: z.boolean(),
});

type FormValues = z.input<typeof FormSchema>;

function LockHint() {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="h-3 w-3" aria-hidden />
      Admin only — ask an admin to change this.
    </p>
  );
}

/**
 * Workspace settings form. Managers may edit the workspace name and digest
 * toggle; currency and the stale threshold are admin-only and show a lock
 * hint for everyone else (UI-DESIGN.md 2.12).
 */
export function WorkspaceForm({
  initial,
  isAdmin,
}: {
  initial: WorkspaceSettings;
  isAdmin: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial,
  });

  const currency = watch("defaultCurrency");
  const digest = watch("digestEnabled");

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    const result = await updateWorkspaceSettings(values);
    setSaving(false);
    if (result.ok) {
      toast.success("Settings saved");
    } else {
      toast.error(result.error === "FORBIDDEN" ? "Only admins can save settings." : "Couldn't save settings.");
    }
  };

  return (
    <div className="max-w-2xl">
      <Toaster position="bottom-right" />
      <PageHeader
        title="Workspace settings"
        kicker="Dealflow / Management"
        description="Configure stages, members, imports, defaults, and workspace governance."
      />
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>How the workspace presents itself and measures hygiene.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="ws-name">Workspace name</FieldLabel>
              <Input id="ws-name" {...register("workspaceName")} maxLength={80} />
              {errors.workspaceName && <FieldError>{errors.workspaceName.message}</FieldError>}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="ws-currency">Default currency</FieldLabel>
              <SelectRoot
                value={currency}
                onValueChange={(v) => setValue("defaultCurrency", v, { shouldDirty: true })}
                disabled={!isAdmin}
              >
                <SelectTrigger id="ws-currency" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
              {!isAdmin ? (
                <LockHint />
              ) : (
                <FieldHint>Used when formatting values across reports.</FieldHint>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="ws-stale">Stale threshold (days)</FieldLabel>
              <Input
                id="ws-stale"
                type="number"
                min={1}
                max={90}
                className="w-32"
                disabled={!isAdmin}
                {...register("staleThresholdDays")}
              />
              {errors.staleThresholdDays && (
                <FieldError>{errors.staleThresholdDays.message}</FieldError>
              )}
              {!isAdmin ? (
                <LockHint />
              ) : (
                <FieldHint>
                  A deal is stalled when untouched for longer than this. Default 14.
                </FieldHint>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border p-4">
              <div>
                <FieldLabel htmlFor="ws-digest">Weekly digest</FieldLabel>
                <FieldHint>Send the team a Monday summary of pipeline movement.</FieldHint>
              </div>
              <Switch
                id="ws-digest"
                checked={digest}
                onCheckedChange={(v) => setValue("digestEnabled", v, { shouldDirty: true })}
              />
            </div>

            <div>
              <Button type="submit" disabled={saving || !isDirty}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
