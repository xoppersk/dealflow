import type { ReactNode } from "react";
import { AppShell } from "@/components/df/app-shell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
