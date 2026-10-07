"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

/**
 * Supabase Realtime wiring (DATABASE-SCHEMA.md §6).
 *
 * Channels:
 * - `workspace:deals`      — postgres_changes on public.deals (all events)
 * - `workspace:activities`  — postgres_changes on public.activities (INSERT)
 * - `workspace:stages`      — postgres_changes on public.pipeline_stages
 * - presence on `workspace:deals` / `deal:<id>` — teammate avatars viewing now
 *
 * RLS applies to realtime payloads: subscribers only receive rows their
 * policies allow, so realtime never leaks deals a viewer can't see.
 * The `version` column rides in every `deals` payload (replica identity FULL)
 * so clients can detect they are behind and reconcile.
 */

export type DealChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;
export type ActivityInsertPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

function useChannel(topic: string, setup: (channel: RealtimeChannel) => RealtimeChannel) {
  useEffect(() => {
    const supabase = createClient();
    const channel = setup(supabase.channel(topic));
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);
}

/** Subscribe to deal row changes; handler receives the raw realtime payload. */
export function useDealsChannel(onChange: (payload: DealChangePayload) => void) {
  const queryClient = useQueryClient();
  const handler = useMemo(() => onChange, [onChange]);
  useChannel("workspace:deals", (channel) =>
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "deals" },
      (payload: DealChangePayload) => {
        handler(payload);
        // Reconcile anything the event stream missed (reconnect path).
        queryClient.invalidateQueries({ queryKey: ["deals"] });
      },
    ),
  );
}

/** Subscribe to new activities (INSERT only). */
export function useActivitiesChannel(onInsert: (payload: ActivityInsertPayload) => void) {
  const queryClient = useQueryClient();
  const handler = useMemo(() => onInsert, [onInsert]);
  useChannel("workspace:activities", (channel) =>
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activities" },
      (payload: ActivityInsertPayload) => {
        handler(payload);
        queryClient.invalidateQueries({ queryKey: ["activities"] });
      },
    ),
  );
}

/** Subscribe to pipeline stage config changes (rare; re-renders board columns). */
export function useStagesChannel() {
  const queryClient = useQueryClient();
  useChannel("workspace:stages", (channel) =>
    channel.on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stages" }, () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    }),
  );
}

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Presence: who else is viewing this topic right now.
 * Payloads carry only user id, name, and avatar — no deal data — and the
 * subscription is RLS-gated, so presence never reveals unauthorized rows.
 */
export function usePresence(
  topic: string | null,
  self: PresenceUser | null,
): PresenceUser[] {
  const [others, setOthers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    // Clear stale presences when there is nothing to subscribe to.
    if (!topic || !self) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOthers([]);
      return;
    }
    const supabase = createClient();
    const channel = supabase.channel(topic, {
      config: { presence: { key: self.userId } },
    });

    const sync = () => {
      const state = channel.presenceState<{ userId: string; name: string; avatarUrl: string | null }>();
      const seen = new Map<string, PresenceUser>();
      for (const presences of Object.values(state)) {
        for (const p of presences) {
          if (p.userId !== self.userId && !seen.has(p.userId)) {
            seen.set(p.userId, { userId: p.userId, name: p.name, avatarUrl: p.avatarUrl });
          }
        }
      }
      setOthers([...seen.values()]);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: self.userId,
            name: self.name,
            avatarUrl: self.avatarUrl,
          });
        }
      });

    // 30s heartbeat keeps stale entries from lingering.
    const heartbeat = setInterval(() => {
      channel.track({ userId: self.userId, name: self.name, avatarUrl: self.avatarUrl });
    }, 30_000);

    return () => {
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
  }, [topic, self?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return others;
}
