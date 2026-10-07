/**
 * Mobile bottom navigation (md and below): Dashboard, Pipeline, Search
 * (opens the palette), Activities (overdue badge), and a More sheet with
 * Companies, Reports (role-gated), Settings, and Sign out.
 *
 * Touch targets are 44px+ per the mobile convention.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MoreHorizontal,
  Search,
  Settings,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import type { UserRole } from "@/lib/supabase/types";

import { BrandMark } from "./brand-mark";

interface BottomNavProps {
  role: UserRole;
  overdueCount?: number;
  onOpenPalette: () => void;
}

const MORE_LINKS = [
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function BottomNav({ role, overdueCount = 0, onOpenPalette }: BottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const tab = (active: boolean) =>
    cn(
      "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
      active ? "text-primary" : "text-muted-foreground",
    );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <Link href="/" className={tab(pathname === "/")}>
          <LayoutDashboard className="h-6 w-6" />
          Dashboard
        </Link>
        <Link
          href="/pipeline"
          className={tab(pathname.startsWith("/pipeline") || pathname.startsWith("/deals"))}
        >
          <KanbanSquare className="h-6 w-6" />
          Pipeline
        </Link>
        <button
          type="button"
          onClick={onOpenPalette}
          className={tab(false)}
          aria-label="Search"
        >
          <Search className="h-6 w-6" />
          Search
        </button>
        <Link href="/activities" className={tab(pathname.startsWith("/activities"))}>
          <span className="relative">
            <ListTodo className="h-6 w-6" />
            {overdueCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-2 -top-1.5 h-5 min-w-5 justify-center px-1 text-[11px]"
              >
                {overdueCount > 99 ? "99+" : overdueCount}
              </Badge>
            )}
          </span>
          Activities
        </Link>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={tab(false)}
          aria-label="More"
        >
          <MoreHorizontal className="h-6 w-6" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>
              <BrandMark size={26} />
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-1 py-4">
            {MORE_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  {item.label}
                </Link>
              );
            })}
            {(role === "manager" || role === "admin") && (
              <Link
                href="/reports"
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-accent"
              >
                <KanbanSquare className="h-5 w-5 text-muted-foreground" />
                Reports
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-accent"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
