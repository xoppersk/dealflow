"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { CompanyPicker, type CompanyOption } from "@/components/companies/company-picker";
import { createContact, checkContactEmail, listActiveUsers, type DuplicateWarning } from "@/lib/actions/contacts";
import type { UserRow } from "@/lib/supabase/types";

const newContactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  title: z.string().trim().max(120).optional(),
  ownerId: z.string().min(1, "Owner is required."),
});

interface NewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompany?: CompanyOption | null;
  currentUserId: string;
  onCreated?: (id: string) => void;
}

/**
 * New contact dialog — name, email, phone, company typeahead with inline
 * "＋ New company" mini-form, title, owner. Duplicate email is a
 * NON-BLOCKING warning: create anyway or view the existing contact.
 */
export function NewContactDialog({
  open,
  onOpenChange,
  defaultCompany,
  currentUserId,
  onCreated,
}: NewContactDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<UserRow[]>([]);
  const [company, setCompany] = useState<CompanyOption | null>(defaultCompany ?? null);
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  useEffect(() => {
    if (!open) return;
    listActiveUsers().then((r) => r.ok && setOwners(r.data));
    setDuplicate(null);
    setForceCreate(false);
  }, [open ]);

  const form = useForm<z.infer<typeof newContactSchema>>({
    resolver: zodResolver(newContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      title: "",
      ownerId: currentUserId,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ firstName: "", lastName: "", email: "", phone: "", title: "", ownerId: currentUserId });
      setCompany(defaultCompany ?? null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(values: z.infer<typeof newContactSchema>) {
    // Non-blocking duplicate check BEFORE creating (never double-creates).
    if (values.email && !forceCreate) {
      const check = await checkContactEmail(values.email);
      if (check.ok && check.data) {
        setDuplicate(check.data);
        setForceCreate(true);
        return;
      }
    }
    setSaving(true);
    const res = await createContact({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email || null,
      phone: values.phone || null,
      title: values.title || null,
      companyId: company?.id ?? null,
      ownerId: values.ownerId,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Contact created.");
    const id = res.data.id;
    onOpenChange(false);
    router.refresh();
    onCreated?.(id);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New contact"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(submit)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {duplicate && forceCreate ? "Create anyway" : "Create contact"}
          </Button>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 py-2">
        {duplicate && (
          <div className="flex items-start gap-2 rounded-md border border-[var(--warning)]/40 bg-[var(--warning-soft)] p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
            <p>
              A contact with this email exists —{" "}
              <Link
                href={`/contacts/${duplicate.id}`}
                className="font-medium text-primary underline"
                onClick={() => onOpenChange(false)}
              >
                view {duplicate.name}
              </Link>{" "}
              or create anyway.
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nc-first">First name</Label>
            <Input id="nc-first" {...form.register("firstName")} />
            {form.formState.errors.firstName && (
              <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nc-last">Last name</Label>
            <Input id="nc-last" {...form.register("lastName")} />
            {form.formState.errors.lastName && (
              <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nc-email">Email</Label>
          <Input id="nc-email" type="email" {...form.register("email")} placeholder="maya@northwind.com" />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nc-phone">Phone</Label>
            <Input id="nc-phone" {...form.register("phone")} placeholder="+1 215 555 0100" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nc-title">Title</Label>
            <Input id="nc-title" {...form.register("title")} placeholder="VP Operations" />
          </div>
        </div>
        <CompanyPicker value={company} onChange={setCompany} />
        <div className="grid gap-1.5">
          <Label htmlFor="nc-owner">Owner</Label>
          <Select value={form.watch("ownerId")} onValueChange={(v) => form.setValue("ownerId", v, { shouldDirty: true })}>
            <SelectTrigger id="nc-owner">
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
      </form>
    </FormDialog>
  );
}
