/**
 * Desktop left sidebar — the dark-green ledger rail. Brand mark on top,
 * primary nav (Pipeline first, per the approved nav order), active route
 * carries the gold inset indicator. Reports is manager/admin only;
 * Activities carries the overdue badge. Bottom: signed-in user.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { UserRole } from "@/lib/supabase/types";

import { BrandMark } from "./brand-mark";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Prefix match against the pathname (e.g. /pipeline matches /deals/…). */
  activeFor: string[];
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { label: "Pipeline", href: "/pipeline", icon: KanbanSquare, activeFor: ["/pipeline", "/deals"] },
  { label: "Today", href: "/", icon: LayoutDashboard, activeFor: ["__root__"] },
  { label: "Activities", href: "/activities", icon: ListTodo, activeFor: ["/activities"] },
  { label: "Contacts", href: "/contacts", icon: Users, activeFor: ["/contacts"] },
  { label: "Companies", href: "/companies", icon: Building2, activeFor: ["/companies"] },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    activeFor: ["/reports"],
    roles: ["manager", "admin"],
  },
  { label: "Settings", href: "/settings", icon: Settings, activeFor: ["/settings"] },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.activeFor.includes("__root__")) return pathname === "/";
  return item.activeFor.some((prefix) => pathname.startsWith(prefix));
}

export function Sidebar({
  user,
  role,
  overdueCount = 0,
}: {
  user: { id: string; name: string; avatarUrl: string | null };
  role: UserRole;
  overdueCount?: number;
}) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/" aria-label="Dealflow home">
          <BrandMark size={26} color="#eef5ef" />
        </Link>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-active text-sidebar-foreground shadow-[inset_3px_0_0_var(--sidebar-indicator)]"
                  : "text-sidebar-nav hover:bg-sidebar-active/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Activities" && overdueCount > 0 && (
                <Badge variant="destructive" className="min-w-6 justify-center">
                  {overdueCount > 99 ? "99+" : overdueCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 border-t border-sidebar-border px-5 py-4">
        <UserAvatar userId={user.id} name={user.name} avatarUrl={user.avatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-sidebar-nav">
            {role === "admin" ? "Workspace owner" : role === "manager" ? "Manager" : "Sales rep"}
          </p>
        </div>
      </div>
    </aside>
  );
}
