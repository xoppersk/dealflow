"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CloseDealDialog } from "@/components/pipeline/close-deal-dialog";
import { deleteDeal, reassignDeal, reopenDeal } from "@/lib/actions/deals";
import { listActiveUsers } from "@/lib/actions/contacts";
import type { DealRow, PipelineStageRow, UserRole, UserRow } from "@/lib/supabase/types";

function isManagerOrAdmin(role: UserRole): boolean {
  return role === "manager" || role === "admin";
}

interface DealActionsMenuProps {
  deal: DealRow;
  stages: PipelineStageRow[];
  role: UserRole;
  currentUserId: string;
}

/**
 * ⋯ menu on the deal detail: Reassign (manager/admin), Mark won/lost,
 * Reopen (manager/admin, closed deals only), Delete (admin: hard-delete option).
 */
export function DealActionsMenu({ deal, stages, role, currentUserId }: DealActionsMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [closeMode, setCloseMode] = useState<"won" | "lost" | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);

  const canManage = isManagerOrAdmin(role);
  const isAdmin = role === "admin";
  const isClosed = deal.closed_at !== null;

  useEffect(() => {
    if (reassignOpen && users.length === 0) {
      listActiveUsers().then((r) => r.ok && setUsers(r.data));
    }
  }, [reassignOpen, users.length]);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canManage && !isClosed && (
            <DropdownMenuItem onSelect={() => setReassignOpen(true)}>
              Reassign…
            </DropdownMenuItem>
          )}
          {!isClosed && (
            <>
              <DropdownMenuItem onSelect={() => setCloseMode("won")}>
                Mark won
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCloseMode("lost")}>
                Mark lost
              </DropdownMenuItem>
            </>
          )}
          {canManage && isClosed && (
            <DropdownMenuItem onSelect={() => setReopenOpen(true)}>
              Reopen…
            </DropdownMenuItem>
          )}
          {(canManage || !isClosed) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CloseDealDialog
        dealId={deal.id}
        dealName={deal.name}
        mode={closeMode ?? "won"}
        open={closeMode !== null}
        onOpenChange={(open) => !open && setCloseMode(null)}
      />

      <ReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        deal={deal}
        users={users}
        currentUserId={currentUserId}
        onDone={() => {
          setReassignOpen(false);
          router.refresh();
        }}
      />

      <ReopenDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        deal={deal}
        stages={stages}
        onDone={() => {
          setReopenOpen(false);
          router.refresh();
        }}
      />

      <DeleteDealDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        deal={deal}
        isAdmin={isAdmin}
      />
    </>
  );
}

function ReassignDialog({
  open,
  onOpenChange,
  deal,
  users,
  currentUserId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRow;
  users: UserRow[];
  currentUserId: string;
  onDone: () => void;
}) {
  const [newOwnerId, setNewOwnerId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!newOwnerId || newOwnerId === deal.owner_id) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    const res = await reassignDeal({ id: deal.id, newOwnerId });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const name = users.find((u) => u.id === newOwnerId)?.full_name ?? "the new owner";
    toast.success(`Deal reassigned to ${name}.`);
    onDone();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Reassign "${deal.name}"`}
      description="The reassignment is recorded in the audit trail."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !newOwnerId}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reassign
          </Button>
        </>
      }
    >
      <div className="grid gap-1.5 py-2">
        <Label>New owner</Label>
        <Select value={newOwnerId} onValueChange={setNewOwnerId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a teammate" />
          </SelectTrigger>
          <SelectContent>
            {users
              .filter((u) => u.id !== deal.owner_id)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                  {u.id === currentUserId ? " (you)" : ""}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </FormDialog>
  );
}

function ReopenDialog({
  open,
  onOpenChange,
  deal,
  stages,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRow;
  stages: PipelineStageRow[];
  onDone: () => void;
}) {
  const [stageId, setStageId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const openStages = stages.filter((s) => !s.is_closed_won && !s.is_closed_lost);

  async function submit() {
    if (!stageId || !reason.trim()) {
      toast.error("Choose a stage and enter a reason.");
      return;
    }
    setBusy(true);
    const res = await reopenDeal({ id: deal.id, stageId, reason: reason.trim() });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Deal reopened.");
    onDone();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Reopen "${deal.name}"`}
      description="The deal returns to an open stage. The reason is recorded in the audit trail."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reopen deal
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label>Move to stage</Label>
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an open stage" />
            </SelectTrigger>
            <SelectContent>
              {openStages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reopen-reason">Reason</Label>
          <Input
            id="reopen-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this deal back in play?"
          />
        </div>
      </div>
    </FormDialog>
  );
}

function DeleteDealDialog({
  open,
  onOpenChange,
  deal,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRow;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hard, setHard] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await deleteDeal({ id: deal.id, hard: hard && isAdmin });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(hard && isAdmin ? "Deal permanently deleted." : "Deal deleted.");
    onOpenChange(false);
    router.push("/pipeline");
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete "${deal.name}"?`}
      description={
        isAdmin
          ? "Soft delete hides it from lists and it can be recovered from the audit view. Permanent delete removes it forever and writes an audit entry first."
          : "The deal is hidden from lists and can be recovered by an admin."
      }
      confirmLabel={hard && isAdmin ? "Delete permanently" : "Delete deal"}
      loading={busy}
      onConfirm={submit}
    >
      {isAdmin && (
        <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Checkbox checked={hard} onCheckedChange={(v) => setHard(v === true)} />
          <span>
            Delete permanently
            <span className="block text-xs text-muted-foreground">Cannot be undone.</span>
          </span>
        </label>
      )}
    </ConfirmDialog>
  );
}
