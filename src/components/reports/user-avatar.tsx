"use client";

import { avatarHue, initials } from "@/lib/format";

import { cn } from "./ui";

/**
 * Initials-on-color avatar, deterministic hue per user (hash of the id).
 * Zero image payload; falls back gracefully when no name is available.
 */
export function UserAvatar({
  userId,
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  userId: string;
  name: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  const hue = avatarHue(userId);

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? "User"}
        className={cn("rounded-full object-cover", sizeClass, className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizeClass,
        className,
      )}
      style={{ backgroundColor: `hsl(${hue} 45% 38%)` }}
    >
      {initials(name ?? "?")}
    </span>
  );
}
