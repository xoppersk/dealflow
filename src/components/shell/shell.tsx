/**
 * Authenticated shell: desktop gets the left sidebar + topbar, mobile gets
 * the topbar + bottom nav. Owns the command palette's open state and the
 * global Cmd/Ctrl+K listener so every trigger drives the same palette.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import type { UserRole } from "@/lib/supabase/types";
import { AppProviders } from "@/components/providers";

import { BottomNav } from "./bottom-nav";
import dynamic from "next/dynamic";

/**
 * The ⌘K palette (cmdk) is lazy-loaded: its ~60KB only downloads the first
 * time the user opens it, keeping every route's initial JS lean.
 */
const CommandPalette = dynamic(
  () => import("./command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
}

export function Shell({
  user,
  overdueCount = 0,
  pendingCount = 0,
  children,
}: {
  user: ShellUser;
  overdueCount?: number;
  pendingCount?: number;
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);

  // Cmd+K / Ctrl+K toggles the palette from anywhere in the shell.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AppProviders>
      <div className="flex min-h-dvh bg-background text-foreground">
        <Sidebar role={user.role} overdueCount={overdueCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={user}
            overdueCount={overdueCount}
            pendingCount={pendingCount}
            onOpenPalette={openPalette}
          />
          <main className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-10 md:pt-6">
            {children}
          </main>
          <BottomNav
            role={user.role}
            overdueCount={overdueCount}
            onOpenPalette={openPalette}
          />
        </div>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </AppProviders>
  );
}
