"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { createCompany } from "@/lib/actions/companies";
import { listActiveUsers } from "@/lib/actions/contacts";
import type { CompanyRow, UserRow } from "@/lib/supabase/types";
import { useEffect } from "react";

const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"];

const newCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(200),
  industry: z.string().trim().max(120).nullable(),
  website: z.string().trim().max(255).nullable(),
  size: z.string().trim().max(60).nullable(),
  ownerId: z.string().uuid().nullable(),
});

interface NewCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onCreated?: (company: CompanyRow) => void;
}

/** New company dialog — also used inline from the company typeahead. */
export function NewCompanyDialog({ open, onOpenChange, defaultName, onCreated }: NewCompanyDialogProps) {
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<UserRow[]>([]);

  useEffect(() => {
    if (!open) return;
    listActiveUsers().then((res) => {
      if (res.ok) setOwners(res.data);
    });
  }, [open ]);

  const form = useForm<z.infer<typeof newCompanySchema>>({
    resolver: zodResolver(newCompanySchema),
    defaultValues: {
      name: defaultName ?? "",
      industry: null,
      website: null,
      size: null,
      ownerId: null,
    },
  });

  useEffect(() => {
    if (open) form.reset({ name: defaultName ?? "", industry: null, website: null, size: null, ownerId: null });
  }, [open, defaultName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: z.infer<typeof newCompanySchema>) {
    setSaving(true);
    const res = await createCompany({ ...values, ownerId: values.ownerId ?? undefined });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`"${res.data.name}" created.`);
    onOpenChange(false);
    onCreated?.(res.data);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New company"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create company
          </Button>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label htmlFor="nc-name">Name</Label>
          <Input id="nc-name" {...form.register("name")} placeholder="Northwind Traders" />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nc-industry">Industry</Label>
          <Input
            id="nc-industry"
            {...form.register("industry")}
            value={form.watch("industry") ?? ""}
            placeholder="Logistics, SaaS…"
          />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nc-website">Website</Label>
            <Input
              id="nc-website"
              {...form.register("website")}
              value={form.watch("website") ?? ""}
              placeholder="northwind.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nc-size">Size</Label>
            <Select
              value={form.watch("size") ?? ""}
              onValueChange={(v) => form.setValue("size", v, { shouldDirty: true })}
            >
              <SelectTrigger id="nc-size">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s} people
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nc-owner">Owner</Label>
          <Select
            value={form.watch("ownerId") ?? ""}
            onValueChange={(v) => form.setValue("ownerId", v || null, { shouldDirty: true })}
          >
            <SelectTrigger id="nc-owner">
              <SelectValue placeholder="Defaults to you" />
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
      </form>
    </FormDialog>
  );
}
