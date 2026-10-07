"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import type { PresenceUser } from "@/lib/realtime/channels";

/** "Viewing now" avatar stack for a deal or board topic. */
export function PresenceStack({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((u) => (
          <UserAvatar
            key={u.userId}
            userId={u.userId}
            name={u.name}
            avatarUrl={u.avatarUrl}
            size="sm"
            className="ring-2 ring-background"
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        Viewing now: {users.map((u) => u.name).join(", ")}
        {users.length > 5 && ` +${users.length - 5}`}
      </span>
    </div>
  );
}
