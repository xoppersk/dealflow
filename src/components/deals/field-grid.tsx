"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { updateDeal } from "@/lib/actions/deals";
import { formatCurrency } from "@/lib/format";
import type { DealRow, DealType } from "@/lib/supabase/types";

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  new_business: "New business",
  renewal: "Renewal",
  expansion: "Expansion",
  other: "Other",
};

const fieldGridSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  value: z.coerce.number().min(0, "Value must be 0 or more."),
  probability: z.number().int().min(0).max(100).nullable(),
  closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable(),
  dealType: z.enum(["new_business", "renewal", "expansion", "other"]),
  source: z.string().trim().max(120).nullable(),
  description: z.string().trim().max(5000).nullable(),
});

type FieldGridValues = z.infer<typeof fieldGridSchema>;

interface FieldGridProps {
  deal: DealRow;
  editing: boolean;
  onDone: () => void;
}

/**
 * Editable field grid (Details tab). In `editing` mode the fields become
 * inputs with Save/Cancel and inline validation; otherwise read-only.
 */
export function FieldGrid({ deal, editing, onDone }: FieldGridProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const form = useForm<FieldGridValues>({
    resolver: zodResolver(fieldGridSchema) as Resolver<FieldGridValues>,
    defaultValues: {
      name: deal.name,
      value: deal.value,
      probability: deal.probability,
      closeDate: deal.close_date,
      dealType: deal.deal_type,
      source: deal.source,
      description: deal.description,
    },
  });
  const probability = form.watch("probability");

  async function onSubmit(values: FieldGridValues) {
    setSaving(true);
    const result = await updateDeal({ id: deal.id, ...values });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Deal updated.");
    onDone();
    router.refresh();
  }

  function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
    return (
      <div className="grid gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {children}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (!editing) {
    const rows: { label: string; value: React.ReactNode }[] = [
      { label: "Deal name", value: deal.name },
      { label: "Value", value: formatCurrency(deal.value, deal.currency) },
      {
        label: "Probability",
        value: deal.probability === null ? "—" : `${deal.probability}%`,
      },
      {
        label: "Close date",
        value: deal.close_date
          ? new Date(`${deal.close_date}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
      },
      { label: "Deal type", value: DEAL_TYPE_LABELS[deal.deal_type] },
      { label: "Source", value: deal.source ?? "—" },
    ];
    return (
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-medium text-muted-foreground">{r.label}</dt>
            <dd className="mt-1 text-sm">{r.value}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Description</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm">
            {deal.description || <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
      <Field label="Deal name" error={form.formState.errors.name?.message}>
        <Input {...form.register("name")} />
      </Field>
      <Field label="Value" error={form.formState.errors.value?.message}>
        <Input type="number" min={0} step="0.01" {...form.register("value")} />
      </Field>
      <Field label={`Probability${probability !== null ? ` — ${probability}%` : ""}`}>
        <div className="flex items-center gap-3 pt-2">
          <Slider
            value={[probability ?? 0]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => form.setValue("probability", v[0] ?? 0, { shouldDirty: true })}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => form.setValue("probability", null, { shouldDirty: true })}
          >
            Clear
          </Button>
        </div>
      </Field>
      <Field label="Close date" error={form.formState.errors.closeDate?.message}>
        <Input type="date" {...form.register("closeDate")} value={form.watch("closeDate") ?? ""} />
      </Field>
      <Field label="Deal type">
        <Select
          value={form.watch("dealType")}
          onValueChange={(v) => form.setValue("dealType", v as DealType, { shouldDirty: true })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Source">
        <Input {...form.register("source")} value={form.watch("source") ?? ""} placeholder="Referral, inbound…" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea {...form.register("description")} value={form.watch("description") ?? ""} rows={4} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
