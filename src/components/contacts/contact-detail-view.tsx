"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ActivityComposer } from "@/components/activities/activity-composer";
import { Timeline } from "@/components/activities/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { NewDealDialog } from "@/components/deals/new-deal-dialog";
import { CompanyPicker, type CompanyOption } from "@/components/companies/company-picker";
import { deleteContact, updateContact, type ContactDetailData } from "@/lib/actions/contacts";
import { formatCurrency, fullName } from "@/lib/format";
import type { TimelineEntry } from "@/lib/types";

interface ContactDetailViewProps {
  data: ContactDetailData;
  currentUserId: string;
}

const editContactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(255).nullable(),
  phone: z.string().trim().max(40).nullable(),
  title: z.string().trim().max(120).nullable(),
});

export function ContactDetailView({ data, currentUserId }: ContactDetailViewProps) {
  const router = useRouter();
  const { contact, company, owner, deals, activities } = data;
  const [tab, setTab] = useState("timeline");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [companyOpt, setCompanyOpt] = useState<CompanyOption | null>(
    company ? { id: company.id, name: company.name } : null,
  );

  const name = fullName(contact.first_name, contact.last_name);

  const form = useForm<z.infer<typeof editContactSchema>>({
    resolver: zodResolver(editContactSchema),
    defaultValues: {
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
    },
  });

  const entries: TimelineEntry[] = useMemo(
    () =>
      activities.map((a) => ({
        id: a.id,
        kind: a.type,
        subject: a.dealName ? `${a.subject ?? a.type} — ${a.dealName}` : a.subject,
        body: a.body,
        occurredAt: a.occurred_at,
        actorName: a.ownerName,
        actorAvatarUrl: null,
        dealId: a.deal_id,
        contactId: a.contact_id,
      })),
    [activities],
  );

  function copy(value: string, key: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  async function save(values: z.infer<typeof editContactSchema>) {
    setSaving(true);
    const res = await updateContact({
      id: contact.id,
      ...values,
      companyId: companyOpt?.id ?? null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Contact updated.");
    setEditing(false);
    router.refresh();
  }

  async function confirmDelete() {
    setDeleting(true);
    const res = await deleteContact(contact.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Contact deleted.");
    setDeleteOpen(false);
    router.push("/contacts");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Profile header */}
      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <UserAvatar userId={contact.id} name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="df-page-title">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {contact.title && <span>{contact.title}</span>}
              {company && (
                <Link href={`/companies/${company.id}`} className="font-medium text-primary hover:underline">
                  {company.name}
                </Link>
              )}
              {owner && <span>Owner: {owner.full_name}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {contact.email && (
                <span className="flex items-center gap-1 rounded-[2px] border px-2 py-1 text-sm">
                  {contact.email}
                  <button
                    type="button"
                    aria-label="Copy email"
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => copy(contact.email!, "email")}
                  >
                    {copied === "email" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </span>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1 rounded-[2px] border px-2 py-1 text-sm">
                  {contact.phone}
                  <button
                    type="button"
                    aria-label="Copy phone"
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => copy(contact.phone!, "phone")}
                  >
                    {copied === "phone" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActivityComposer contactId={contact.id} />
          <Button variant="outline" size="sm" onClick={() => setDealOpen(true)}>
            <Plus className="h-4 w-4" />
            New deal
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <div className="grid gap-4">
            <Card className="p-4">
              <ActivityComposer contactId={contact.id} />
            </Card>
            <Timeline entries={entries} />
          </div>
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          {deals.length === 0 ? (
            <EmptyState
              title="No deals linked"
              description={`${name} isn't linked to any deals yet.`}
              action={
                <Button onClick={() => setDealOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New deal
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-2">
              {deals.map(({ deal, role }) => (
                <li key={deal.id}>
                  <Link
                    href={`/deals/${deal.id}`}
                    className="flex items-center gap-3 rounded-[2px] border bg-card p-3 hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{deal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {role && `${role} · `}
                        {formatCurrency(deal.value, deal.currency)}
                      </p>
                    </div>
                    {deal.stageName && (
                      <Badge variant="secondary" className="gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: deal.stageColor ?? "#78716c" }} />
                        {deal.stageName}
                      </Badge>
                    )}
                    {deal.closed_at && <Badge variant="outline">Closed</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card className="p-4 sm:p-6">
            {editing ? (
              <form onSubmit={form.handleSubmit(save)} className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>First name</Label>
                  <Input {...form.register("firstName")} />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Last name</Label>
                  <Input {...form.register("lastName")} />
                  {form.formState.errors.lastName && (
                    <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" {...form.register("email")} value={form.watch("email") ?? ""} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Phone</Label>
                  <Input {...form.register("phone")} value={form.watch("phone") ?? ""} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Title</Label>
                  <Input {...form.register("title")} value={form.watch("title") ?? ""} />
                </div>
                <CompanyPicker value={companyOpt} onChange={setCompanyOpt} />
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid gap-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: "First name", value: contact.first_name },
                    { label: "Last name", value: contact.last_name },
                    { label: "Email", value: contact.email ?? "—" },
                    { label: "Phone", value: contact.phone ?? "—" },
                    { label: "Title", value: contact.title ?? "—" },
                    { label: "Company", value: company?.name ?? "—" },
                  ].map((r) => (
                    <div key={r.label}>
                      <dt className="text-xs font-medium text-muted-foreground">{r.label}</dt>
                      <dd className="mt-1 text-sm">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit contact
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <NewDealDialog
        open={dealOpen}
        onOpenChange={setDealOpen}
        defaultName={company ? `${company.name} — ` : `${name} — `}
        defaultCompany={companyOpt}
        defaultContactId={contact.id}
        currentUserId={currentUserId}
        onCreated={(id) => router.push(`/deals/${id}`)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${name}?`}
        description={
          deals.length > 0
            ? `This contact is linked to ${deals.length} ${deals.length === 1 ? "deal" : "deals"}. The links will be removed; the deals themselves stay.`
            : "The contact will be hidden from lists."
        }
        confirmLabel="Delete contact"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
