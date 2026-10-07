import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string | null;
}

export interface PresenceStackProps {
  users: PresenceUser[];
  label?: string;
  className?: string;
}

/** Overlapping avatars of people viewing the same record right now. */
export function PresenceStack({
  users,
  label = "Viewing now",
  className,
}: PresenceStackProps) {
  if (users.length === 0) return null;
  const shown = users.slice(0, 5);
  const extra = users.length - shown.length;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex -space-x-2">
        {shown.map((user) => (
          <UserAvatar
            key={user.userId}
            userId={user.userId}
            name={user.name}
            avatarUrl={user.avatarUrl}
            size="sm"
            className="ring-2 ring-background"
          />
        ))}
        {extra > 0 ? (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background"
            aria-label={`${extra} more viewing`}
          >
            +{extra}
          </span>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
