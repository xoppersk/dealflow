"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
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
import { NewContactDialog } from "@/components/contacts/new-contact-dialog";
import { deleteCompany, updateCompany, type CompanyDetailData } from "@/lib/actions/companies";
import { formatCompactCurrency, formatCurrency, fullName } from "@/lib/format";
import type { TimelineEntry } from "@/lib/types";

interface CompanyDetailViewProps {
  data: CompanyDetailData;
  currentUserId: string;
}

const editCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(200),
  industry: z.string().trim().max(120).nullable(),
  website: z.string().trim().max(255).nullable(),
  size: z.string().trim().max(60).nullable(),
});

export function CompanyDetailView({ data, currentUserId }: CompanyDetailViewProps) {
  const router = useRouter();
  const { company, owner, deals, contacts, activities } = data;
  const [tab, setTab] = useState("deals");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openDeals = useMemo(() => deals.filter((d) => !d.closed_at), [deals]);
  const openValue = openDeals.reduce((sum, d) => sum + d.value, 0);

  const form = useForm<z.infer<typeof editCompanySchema>>({
    resolver: zodResolver(editCompanySchema),
    defaultValues: {
      name: company.name,
      industry: company.industry,
      website: company.website,
      size: company.size,
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

  async function save(values: z.infer<typeof editCompanySchema>) {
    setSaving(true);
    const res = await updateCompany({ id: company.id, ...values });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Company updated.");
    setEditing(false);
    router.refresh();
  }

  async function confirmDelete() {
    setDeleting(true);
    const res = await deleteCompany(company.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Company deleted.");
    setDeleteOpen(false);
    router.push("/companies");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Building2 className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="df-page-title">{company.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {company.industry && <span>{company.industry}</span>}
              {company.size && <span>{company.size} people</span>}
              {company.website && (
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {company.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {owner && <span>Owner: {owner.full_name}</span>}
            </div>
            <p className="mt-2 text-sm">
              <span className="tnum font-semibold">{formatCompactCurrency(openValue)}</span>
              <span className="text-muted-foreground"> open pipeline</span>
              <span className="text-muted-foreground"> · </span>
              <span className="tnum font-semibold">{contacts.length}</span>
              <span className="text-muted-foreground"> contacts</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setContactOpen(true)}>
            <Plus className="h-4 w-4" />
            New contact
          </Button>
          <ActivityComposer />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="mt-4">
          {deals.length === 0 ? (
            <EmptyState
              title="No deals at this company"
              description="Deals linked to this company will show up here."
            />
          ) : (
            <ul className="grid gap-2">
              {deals.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/deals/${d.id}`}
                    className="flex items-center gap-3 rounded-[2px] border bg-card p-3 hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.ownerName && `${d.ownerName} · `}
                        {formatCurrency(d.value, d.currency)}
                      </p>
                    </div>
                    {d.stageName && (
                      <Badge variant="secondary" className="gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.stageColor ?? "#78716c" }} />
                        {d.stageName}
                      </Badge>
                    )}
                    {d.closed_at && <Badge variant="outline">Closed</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          {contacts.length === 0 ? (
            <EmptyState
              title="No contacts at this company"
              description="Add the people you work with here."
              action={
                <Button onClick={() => setContactOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New contact
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-2">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contacts/${c.id}`}
                    className="flex items-center gap-3 rounded-[2px] border bg-card p-3 hover:bg-accent/50"
                  >
                    <UserAvatar userId={c.id} name={fullName(c.first_name, c.last_name)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{fullName(c.first_name, c.last_name)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.title, c.email].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          <div className="grid gap-4">
            <Card className="p-4">
              <ActivityComposer />
            </Card>
            <Timeline entries={entries} />
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card className="p-4 sm:p-6">
            {editing ? (
              <form onSubmit={form.handleSubmit(save)} className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Industry</Label>
                  <Input {...form.register("industry")} value={form.watch("industry") ?? ""} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Website</Label>
                  <Input {...form.register("website")} value={form.watch("website") ?? ""} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Size</Label>
                  <Input {...form.register("size")} value={form.watch("size") ?? ""} placeholder="51–200" />
                </div>
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
                    { label: "Name", value: company.name },
                    { label: "Industry", value: company.industry ?? "—" },
                    { label: "Website", value: company.website ?? "—" },
                    { label: "Size", value: company.size ?? "—" },
                  ].map((r) => (
                    <div key={r.label}>
                      <dt className="text-xs font-medium text-muted-foreground">{r.label}</dt>
                      <dd className="mt-1 text-sm">{r.value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit company
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <NewContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        defaultCompany={{ id: company.id, name: company.name }}
        currentUserId={currentUserId}
        onCreated={(id) => router.push(`/contacts/${id}`)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${company.name}?`}
        description={
          contacts.length > 0 || deals.length > 0
            ? `Linked contacts (${contacts.length}) and deals (${deals.length}) keep their records, but their company link will be cleared.`
            : "The company will be hidden from lists."
        }
        confirmLabel="Delete company"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
