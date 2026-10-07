"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, MailPlus, RotateCcw, UserX } from "lucide-react";
import { z } from "zod";
import { Toaster, toast } from "sonner";

import { relativeTime } from "@/lib/format";
import {
  deactivateUser,
  inviteUser,
  listUsers,
  reactivateUser,
  resendInvite,
  updateUserRole,
  type PendingInvite,
  type TeamList,
  type TeamUser,
} from "@/lib/actions/team";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogRoot,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FieldError,
  FieldLabel,
  Input,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TooltipSimple,
} from "@/components/reports/ui";
import { EmptyState, PageHeader } from "@/components/reports/page-header";
import { UserAvatar } from "@/components/reports/user-avatar";

const ROLES = ["rep", "manager", "admin"] as const;

function StatusBadge({ user }: { user: TeamUser }) {
  if (user.inviteStatus === "deactivated") return <Badge variant="muted">Deactivated</Badge>;
  if (user.inviteStatus === "invited") return <Badge variant="warning">Invited</Badge>;
  return <Badge variant="success">Active</Badge>;
}

function RoleSelect({
  user,
  disabled,
  onChanged,
}: {
  user: TeamUser;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [confirmRole, setConfirmRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    if (!confirmRole) return;
    setSaving(true);
    const result = await updateUserRole({
      userId: user.id,
      role: confirmRole as (typeof ROLES)[number],
    });
    setSaving(false);
    setConfirmRole(null);
    if (result.ok) {
      toast.success(`${user.fullName} is now a ${confirmRole}`);
      onChanged();
    } else {
      toast.error(
        result.error === "LAST_ADMIN"
          ? "You can't demote the last admin."
          : result.error === "CANNOT_CHANGE_OWN_ROLE"
            ? "You can't change your own role."
            : "Couldn't change the role.",
      );
    }
  };

  return (
    <>
      <SelectRoot
        value={user.role}
        disabled={disabled || user.inviteStatus === "deactivated"}
        onValueChange={(v) => {
          if (v !== user.role) setConfirmRole(v);
        }}
      >
        <SelectTrigger className="w-32 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r} className="capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>

      <AlertDialogRoot open={confirmRole !== null} onOpenChange={(o) => !o && setConfirmRole(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Make {user.fullName} a {confirmRole}?</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmRole === "admin" || confirmRole === "manager"
              ? `They'll see all team data and gain ${confirmRole === "admin" ? "full workspace control" : "reporting and stage controls"}.`
              : "They'll only see their own deals, contacts, and companies."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button disabled={saving} onClick={apply}>
                {saving ? "Saving…" : "Change role"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </>
  );
}

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(ROLES),
});

function InviteForm({ onSent }: { onSent: () => void }) {
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<{ email: string; role: (typeof ROLES)[number] }>({
    resolver: zodResolver(InviteSchema),
    defaultValues: { email: "", role: "rep" },
  });
  const role = watch("role");

  const onSubmit = async (values: { email: string; role: (typeof ROLES)[number] }) => {
    setSending(true);
    setInviteLink(null);
    const result = await inviteUser(values);
    setSending(false);
    if (result.ok) {
      toast.success(`Invite sent to ${result.data.email}`);
      setInviteLink(result.data.inviteLink);
      reset();
      onSent();
    } else {
      toast.error(
        result.error === "ALREADY_MEMBER"
          ? "That email already belongs to a team member."
          : result.error === "ALREADY_INVITED"
            ? "That email already has a pending invite."
            : "Couldn't send the invite.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite user</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-52 flex-1 flex-col gap-1.5">
            <FieldLabel htmlFor="invite-email">Email</FieldLabel>
            <Input id="invite-email" type="email" placeholder="maya@example.com" {...register("email")} />
            {errors.email && <FieldError>{errors.email.message}</FieldError>}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="invite-role">Role</FieldLabel>
            <SelectRoot value={role} onValueChange={(v) => setValue("role", v as (typeof ROLES)[number])}>
              <SelectTrigger id="invite-role" className="w-36 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </div>
          <Button type="submit" disabled={sending}>
            <MailPlus className="h-4 w-4" />
            {sending ? "Sending…" : "Send invite"}
          </Button>
        </form>
        {inviteLink && (
          <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-xs">
            <span className="min-w-0 flex-1 truncate font-mono">{inviteLink}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink);
                toast.success("Invite link copied");
              }}
            >
              <Copy className="h-3 w-3" /> Copy link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingInviteRow({ invite, onChanged }: { invite: PendingInvite; onChanged: () => void }) {
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const resend = async () => {
    setSending(true);
    const result = await resendInvite({ inviteId: invite.id });
    setSending(false);
    if (result.ok) {
      toast.success("Invite resent");
      setLink(result.data.inviteLink);
      onChanged();
    } else {
      toast.error("Couldn't resend the invite");
    }
  };

  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <UserAvatar userId={invite.id} name={invite.email} size="sm" />
          <span className="text-sm text-muted-foreground">{invite.email}</span>
        </span>
      </TableCell>
      <TableCell className="tnum text-sm text-muted-foreground">{invite.email}</TableCell>
      <TableCell className="text-sm capitalize text-muted-foreground">{invite.role}</TableCell>
      <TableCell>
        <Badge variant="warning">Invited</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">—</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {link && (
            <TooltipSimple label="Copy invite link">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Invite link copied");
                }}
                aria-label="Copy invite link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipSimple>
          )}
          <Button variant="ghost" size="sm" disabled={sending} onClick={resend}>
            {sending ? "Sending…" : "Resend invite"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DeactivateDialog({
  target,
  team,
  selfId,
  onClose,
  onChanged,
}: {
  target: TeamUser | null;
  team: TeamUser[];
  selfId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [reassignTo, setReassignTo] = useState<string>("");
  const [working, setWorking] = useState(false);

  const candidates = team.filter(
    (u) => u.id !== target?.id && u.id !== selfId && u.inviteStatus === "active",
  );

  const confirm = async () => {
    if (!target) return;
    setWorking(true);
    const result = await deactivateUser({
      userId: target.id,
      ...(reassignTo ? { reassignToUserId: reassignTo } : {}),
    });
    setWorking(false);
    if (result.ok) {
      toast.success(
        result.data.reassignedDealCount > 0
          ? `${target.fullName} deactivated — ${result.data.reassignedDealCount} deals reassigned`
          : `${target.fullName} deactivated`,
      );
      onClose();
      onChanged();
    } else {
      toast.error(
        result.error === "LAST_ADMIN"
          ? "You can't deactivate the last admin."
          : "Couldn't deactivate the user.",
      );
    }
  };

  return (
    <AlertDialogRoot open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogTitle>Deactivate {target?.fullName}?</AlertDialogTitle>
        <AlertDialogDescription>
          They won&apos;t be able to sign in anymore, but their name stays on everything they
          touched.{" "}
          {(target?.openDealCount ?? 0) > 0 && (
            <>
              They own{" "}
              <span className="tnum font-medium text-foreground">
                {target?.openDealCount} open {target?.openDealCount === 1 ? "deal" : "deals"}
              </span>
              {" "}— choose who should take them over, or leave them unassigned.
            </>
          )}
        </AlertDialogDescription>
        {(target?.openDealCount ?? 0) > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Reassign their deals to</span>
            <SelectRoot value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Leave unassigned" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={working} onClick={confirm}>
              {working ? "Deactivating…" : "Deactivate"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogRoot>
  );
}

/**
 * Team management (UI-DESIGN.md 2.14): user table with role select, status
 * badges, invite form, deactivate/reactivate with reassignment.
 */
export function TeamManager({ selfId }: { selfId: string }) {
  const [team, setTeam] = useState<TeamList | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamUser | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await listUsers();
    if (result.ok) setTeam(result.data);
    else toast.error("Couldn't load the team");
    setLoading(false);
  };

  // Initial data load: setState-in-effect is intentional here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const reactivate = async (user: TeamUser) => {
    setWorkingId(user.id);
    const result = await reactivateUser({ userId: user.id });
    setWorkingId(null);
    if (result.ok) {
      toast.success(`${user.fullName} reactivated`);
      void load();
    } else {
      toast.error("Couldn't reactivate the user");
    }
  };

  return (
    <div>
      <Toaster position="bottom-right" />
      <PageHeader title="Team" description="Who's in the workspace, what they can do, and who's waiting on an invite." />

      <div className="mb-6">
        <InviteForm onSent={() => void load()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading || !team ? (
            <div className="flex flex-col gap-2 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : team.users.length === 0 && team.pendingInvites.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No team members yet" description="Invite your first teammate above." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.pendingInvites.map((invite) => (
                  <PendingInviteRow key={invite.id} invite={invite} onChanged={() => void load()} />
                ))}
                {team.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <UserAvatar userId={user.id} name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
                        <span className="font-medium">{user.fullName}</span>
                        {user.id === selfId && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <RoleSelect
                        user={user}
                        disabled={user.id === selfId}
                        onChanged={() => void load()}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge user={user} />
                    </TableCell>
                    <TableCell className="tnum whitespace-nowrap text-sm text-muted-foreground">
                      {user.lastSignInAt ? relativeTime(user.lastSignInAt) : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.id !== selfId &&
                        (user.inviteStatus === "deactivated" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={workingId === user.id}
                            onClick={() => void reactivate(user)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reactivate
                          </Button>
                        ) : (
                          <TooltipSimple
                            label={
                              user.id === selfId
                                ? "You can't deactivate yourself"
                                : `Deactivate ${user.fullName}`
                            }
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setDeactivateTarget(user)}
                            >
                              <UserX className="h-4 w-4" />
                              Deactivate
                            </Button>
                          </TooltipSimple>
                        ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeactivateDialog
        target={deactivateTarget}
        team={team?.users ?? []}
        selfId={selfId}
        onClose={() => setDeactivateTarget(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
