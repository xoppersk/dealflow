"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { Toaster, toast } from "sonner";

import {
  createStage,
  deleteStage,
  listStages,
  reorderStages,
  updateStage,
  type StageWithCount,
} from "@/lib/actions/stages";

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
  Input,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  TooltipSimple,
  cn,
} from "@/components/reports/ui";
import { EmptyState, PageHeader } from "@/components/reports/page-header";

/** The 8 curated stage dot colors (UI-DESIGN.md §5). */
export const STAGE_COLORS = [
  "#0F766E",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#D97706",
  "#65A30D",
  "#0891B2",
  "#78716C",
];

function ColorDotPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <TooltipSimple label="Pick a color">
        <button
          type="button"
          aria-label="Pick stage color"
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-transform hover:scale-110"
        >
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: value }} />
        </button>
      </TooltipSimple>
      {open && (
        <>
          <button
            aria-label="Close color picker"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-10 z-20 grid grid-cols-4 gap-2 rounded-md border bg-popover p-2 shadow-md">
            {STAGE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110",
                  value.toLowerCase() === c.toLowerCase() && "ring-2 ring-ring ring-offset-2",
                )}
              >
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SortableStageRow({
  stage,
  onRename,
  onColorChange,
  onDelete,
}: {
  stage: StageWithCount;
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onDelete: (stage: StageWithCount) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const commitRename = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== stage.name) onRename(stage.id, name);
    else setDraft(stage.name);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-[10px] border bg-card p-3 shadow-sm",
        isDragging && "shadow-lg",
      )}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${stage.name}`}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <ColorDotPicker value={stage.color} onChange={(c) => onColorChange(stage.id, c)} />

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(stage.name);
                setEditing(false);
              }
            }}
            className="h-8"
            aria-label="Stage name"
          />
        ) : (
          <p className="truncate text-sm font-medium">{stage.name}</p>
        )}
        <p className="tnum text-xs text-muted-foreground">
          {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
        </p>
      </div>

      {stage.is_closed_won && <Badge variant="success">Closed won</Badge>}
      {stage.is_closed_lost && <Badge variant="muted">Closed lost</Badge>}

      <div className="flex items-center gap-1">
        <TooltipSimple label="Rename">
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label={`Rename ${stage.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
        </TooltipSimple>
        <TooltipSimple label="Delete stage">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(stage)}
            aria-label={`Delete ${stage.name}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipSimple>
      </div>
    </div>
  );
}

function AddStageRow({ onAdd, onCancel }: { onAdd: (name: string, color: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(STAGE_COLORS[0] ?? "#0F766E");
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-dashed bg-card p-3">
      <ColorDotPicker value={color} onChange={setColor} />
      <Input
        autoFocus
        placeholder="Stage name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onAdd(name.trim(), color);
          if (e.key === "Escape") onCancel();
        }}
        className="h-8 flex-1"
        aria-label="New stage name"
      />
      <Button size="sm" disabled={!name.trim()} onClick={() => onAdd(name.trim(), color)}>
        Add
      </Button>
      <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Vertical sortable stage list (UI-DESIGN.md 2.13): drag to reorder, inline
 * rename, color dots, won/lost badges, deal counts, guarded delete.
 */
export function StageManager({ initial }: { initial: StageWithCount[] }) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StageWithCount | null>(null);
  const [moveToId, setMoveToId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = async () => {
    const result = await listStages();
    if (result.ok) setItems(result.data);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const next = arrayMove(items, oldIndex, items.findIndex((i) => i.id === over.id));
    setItems(next);
    const result = await reorderStages({ ids: next.map((i) => i.id) });
    if (result.ok) {
      toast.success("Stage order saved");
    } else {
      toast.error("Couldn't save the new order");
      setItems(items);
    }
  };

  const handleRename = async (id: string, name: string) => {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    const result = await updateStage({ id, name });
    if (result.ok) toast.success("Stage renamed");
    else {
      toast.error("Couldn't rename the stage");
      void refresh();
    }
  };

  const handleColorChange = async (id: string, color: string) => {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
    const result = await updateStage({ id, color });
    if (!result.ok) {
      toast.error("Couldn't update the color");
      void refresh();
    }
  };

  const handleAdd = async (name: string, color: string) => {
    const result = await createStage({ name, color });
    if (result.ok) {
      setAdding(false);
      toast.success(`Stage "${name}" added`);
      void refresh();
    } else {
      toast.error(result.error === "FORBIDDEN" ? "Only managers and admins can add stages." : "Couldn't add the stage");
    }
  };

  const openDelete = (stage: StageWithCount) => {
    if (stage.is_closed_won || stage.is_closed_lost) {
      // The server enforces this too; surface the rule up front.
      const others = items.filter(
        (s) => s.id !== stage.id && (stage.is_closed_won ? s.is_closed_won : s.is_closed_lost),
      );
      if (others.length === 0) {
        toast.error(
          stage.is_closed_won
            ? "You must keep one closed-won stage."
            : "You must keep one closed-lost stage.",
        );
        return;
      }
    }
    setMoveToId("");
    setDeleteTarget(stage);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.dealCount > 0 && !moveToId) {
      toast.error("Choose a stage to receive the deals first.");
      return;
    }
    setDeleting(true);
    const result = await deleteStage({
      id: deleteTarget.id,
      ...(moveToId ? { moveDealsToId: moveToId } : {}),
    });
    setDeleting(false);

    if (result.ok) {
      toast.success(
        result.data.moved > 0
          ? `Stage deleted — ${result.data.moved} deals moved`
          : "Stage deleted",
      );
      setDeleteTarget(null);
      void refresh();
      return;
    }
    if (result.error === "HAS_DEALS") {
      toast.error(`Move ${"data" in result ? result.data.count : deleteTarget.dealCount} deals first`);
    } else if (result.error === "LAST_WON_STAGE" || result.error === "LAST_LOST_STAGE") {
      toast.error("You must keep one won and one lost stage.");
    } else {
      toast.error("Couldn't delete the stage");
    }
    setDeleteTarget(null);
  };

  const moveOptions = deleteTarget ? items.filter((s) => s.id !== deleteTarget.id) : [];

  return (
    <div className="max-w-2xl">
      <Toaster position="bottom-right" />
      <PageHeader
        title="Pipeline stages"
        description="Mirror your sales process. Drag to reorder — the board follows."
        actions={
          !adding && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add stage
            </Button>
          )
        }
      />

      {items.length === 0 && !adding ? (
        <EmptyState
          title="No stages yet"
          description="Add your first stage to start building the pipeline."
          action={<Button onClick={() => setAdding(true)}>Add stage</Button>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {adding && <AddStageRow onAdd={handleAdd} onCancel={() => setAdding(false)} />}
              {items.map((stage) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  onRename={handleRename}
                  onColorChange={handleColorChange}
                  onDelete={openDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialogRoot open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {(deleteTarget?.dealCount ?? 0) > 0 ? (
              <>
                This stage holds{" "}
                <span className="tnum font-medium text-foreground">
                  {deleteTarget?.dealCount} {deleteTarget?.dealCount === 1 ? "deal" : "deals"}
                </span>
                . Move them to another stage first — the move is recorded in stage history.
              </>
            ) : (
              "This stage is empty, so it can be deleted right away."
            )}
          </AlertDialogDescription>
          {(deleteTarget?.dealCount ?? 0) > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Move deals to</span>
              <SelectRoot value={moveToId} onValueChange={setMoveToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a stage" />
                </SelectTrigger>
                <SelectContent>
                  {moveOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
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
              <Button
                variant="destructive"
                disabled={deleting || ((deleteTarget?.dealCount ?? 0) > 0 && !moveToId)}
                onClick={confirmDelete}
              >
                {deleting ? "Deleting…" : "Delete stage"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>

      <Card className="mt-6">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Closed stages are special: the pipeline must always keep one closed-won and one
          closed-lost stage, and stages holding deals can only be deleted after their deals
          move elsewhere.
        </CardContent>
      </Card>
    </div>
  );
}
