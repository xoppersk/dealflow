"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyPicker, type CompanyOption } from "@/components/companies/company-picker";
import { createDeal, listStages } from "@/lib/actions/deals";
import { listActiveUsers } from "@/lib/actions/contacts";
import type { DealType, PipelineStageRow, UserRow } from "@/lib/supabase/types";

const newDealSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  value: z.coerce.number().min(0, "Value must be 0 or more."),
  stageId: z.string().min(1, "Stage is required."),
  closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable(),
  ownerId: z.string().min(1, "Owner is required."),
  dealType: z.enum(["new_business", "renewal", "expansion", "other"]),
  description: z.string().trim().max(5000).nullable(),
});

interface NewDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill from the contact page ("Northwind Traders — "). */
  defaultName?: string;
  defaultCompany?: CompanyOption | null;
  defaultContactId?: string;
  currentUserId: string;
  onCreated?: (id: string) => void;
}

/**
 * New deal dialog — used from contact/company pages (the pipeline page's
 * instance belongs to the pipeline build). Company picker includes the
 * inline "＋ New company" mini-form.
 */
export function NewDealDialog({
  open,
  onOpenChange,
  defaultName,
  defaultCompany,
  defaultContactId,
  currentUserId,
  onCreated,
}: NewDealDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<PipelineStageRow[]>([]);
  const [owners, setOwners] = useState<UserRow[]>([]);
  const [company, setCompany] = useState<CompanyOption | null>(defaultCompany ?? null);

  useEffect(() => {
    if (!open) return;
    listStages().then((r) => r.ok && setStages(r.data));
    listActiveUsers().then((r) => r.ok && setOwners(r.data));
  }, [open ]);

  const form = useForm<z.infer<typeof newDealSchema>>({
    resolver: zodResolver(newDealSchema) as Resolver<z.infer<typeof newDealSchema>>,
    defaultValues: {
      name: defaultName ?? "",
      value: 0,
      stageId: "",
      closeDate: null,
      ownerId: currentUserId,
      dealType: "new_business",
      description: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: defaultName ?? "",
        value: 0,
        stageId: stages[0]?.id ?? "",
        closeDate: null,
        ownerId: currentUserId,
        dealType: "new_business",
        description: null,
      });
      setCompany(defaultCompany ?? null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !form.getValues("stageId") && stages[0]) {
      form.setValue("stageId", stages[0].id);
    }
  }, [open, stages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: z.infer<typeof newDealSchema>) {
    setSaving(true);
    const res = await createDeal({
      ...values,
      companyId: company?.id ?? null,
      currency: "USD",
      contactIds: defaultContactId ? [defaultContactId] : undefined,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Deal created.");
    onOpenChange(false);
    router.refresh();
    onCreated?.(res.data.id);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New deal"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create deal
          </Button>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label htmlFor="nd-name">Name</Label>
          <Input id="nd-name" {...form.register("name")} placeholder="Harborlight Renewal" />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <CompanyPicker value={company} onChange={setCompany} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nd-value">Value (USD)</Label>
            <Input id="nd-value" type="number" min={0} step="0.01" {...form.register("value")} />
            {form.formState.errors.value && (
              <p className="text-xs text-destructive">{form.formState.errors.value.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nd-stage">Stage</Label>
            <Select value={form.watch("stageId")} onValueChange={(v) => form.setValue("stageId", v, { shouldDirty: true })}>
              <SelectTrigger id="nd-stage">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nd-close">Close date</Label>
            <Input
              id="nd-close"
              type="date"
              {...form.register("closeDate")}
              value={form.watch("closeDate") ?? ""}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nd-owner">Owner</Label>
            <Select value={form.watch("ownerId")} onValueChange={(v) => form.setValue("ownerId", v, { shouldDirty: true })}>
              <SelectTrigger id="nd-owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nd-type">Deal type</Label>
          <Select
            value={form.watch("dealType")}
            onValueChange={(v) => form.setValue("dealType", v as DealType, { shouldDirty: true })}
          >
            <SelectTrigger id="nd-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new_business">New business</SelectItem>
              <SelectItem value="renewal">Renewal</SelectItem>
              <SelectItem value="expansion">Expansion</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nd-desc">Description</Label>
          <Textarea
            id="nd-desc"
            rows={3}
            {...form.register("description")}
            value={form.watch("description") ?? ""}
          />
        </div>
      </form>
    </FormDialog>
  );
}
