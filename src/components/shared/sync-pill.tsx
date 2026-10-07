"use client";

import * as React from "react";
import { Clock, RefreshCw, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SyncPillProps {
  pendingCount: number;
  syncing?: boolean;
  className?: string;
}

/**
 * Offline / pending-sync indicator. Shows "Offline" when the browser is
 * offline, "N changes pending" while mutations await sync, and a spinner
 * while syncing. Renders nothing when online and idle.
 */
export function SyncPill({
  pendingCount,
  syncing = false,
  className,
}: SyncPillProps) {
  const [online, setOnline] = React.useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  React.useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && pendingCount === 0 && !syncing) return null;

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground",
        !online && "border-destructive/50 text-destructive",
        className
      )}
    >
      {!online ? (
        <>
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          Offline
        </>
      ) : syncing ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Syncing
        </>
      ) : (
        <>
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {pendingCount} {pendingCount === 1 ? "change" : "changes"} pending
        </>
      )}
    </span>
  );
}
