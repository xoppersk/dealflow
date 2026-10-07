/**
 * Authenticated topbar: global search trigger (⌘K), the "＋ New"
 * quick-create menu, the overdue bell, the offline sync pill, and the
 * user menu with theme toggle + sign out.
 */

"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  KanbanSquare,
  Laptop,
  ListTodo,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { SyncPill } from "@/components/shared/sync-pill";

import type { ShellUser } from "./shell";

const QUICK_CREATE = [
  { label: "New deal", href: "/pipeline?create=1", icon: KanbanSquare },
  { label: "New contact", href: "/contacts?create=1", icon: Users },
  { label: "New company", href: "/companies?create=1", icon: Building2 },
  { label: "Log activity", href: "/activities?create=1", icon: ListTodo },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function Topbar({
  user,
  overdueCount = 0,
  pendingCount = 0,
  onOpenPalette,
}: {
  user: ShellUser;
  overdueCount?: number;
  pendingCount?: number;
  onOpenPalette: () => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-6">
      {/* Search trigger (⌘K) */}
      <Button
        variant="outline"
        onClick={onOpenPalette}
        className="h-10 min-w-0 flex-1 justify-start gap-2 text-sm font-normal text-muted-foreground md:max-w-md"
        aria-label="Search (Command K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search deals, contacts…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border px-1.5 text-xs md:inline">
          ⌘K
        </kbd>
      </Button>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {/* Quick create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 md:h-9" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
              <ChevronDown className="hidden h-4 w-4 sm:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {QUICK_CREATE.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Overdue bell */}
        <Button variant="ghost" size="icon" className="relative h-11 w-11" asChild>
          <Link href="/activities" aria-label={`Activities${overdueCount > 0 ? `, ${overdueCount} overdue` : ""}`}>
            <Bell className="h-5 w-5" />
            {overdueCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-0.5 -top-0.5 h-5 min-w-5 justify-center px-1 text-[11px]"
              >
                {overdueCount > 99 ? "99+" : overdueCount}
              </Badge>
            )}
          </Link>
        </Button>

        {/* Offline sync pill */}
        <SyncPill pendingCount={pendingCount} />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              aria-label="Account menu"
            >
              <Avatar className="h-9 w-9">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={(event) => {
                    event.preventDefault();
                    setTheme(option.value);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {option.label}
                  {active && (
                    <Check className={cn("ml-auto h-4 w-4")} aria-label="Current theme" />
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
