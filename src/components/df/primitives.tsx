import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Person, Urgency } from "@/lib/df/types";

/* ---------- Button (§7) ---------- */
type BtnVariant = "pri" | "progress" | "outline" | "destructive" | "destructive-fill";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  /** Blocked state: rendered disabled with the reason in `title` (§7). */
  blockedReason?: string;
}

export function Button({ variant = "outline", size, blockedReason, className = "", ...rest }: ButtonProps) {
  const variantClass = variant === "outline" ? "" : variant;
  const sizeClass = size && size !== "md" ? size : "";
  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={Boolean(blockedReason) || rest.disabled}
      title={blockedReason ?? rest.title}
      {...rest}
    />
  );
}

export function ButtonLink({
  href,
  variant = "outline",
  size,
  className = "",
  children,
}: {
  href: string;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const variantClass = variant === "outline" ? "" : variant;
  const sizeClass = size && size !== "md" ? size : "";
  return (
    <Link href={href} className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}

/* ---------- UrgencyLabel (§7): urgency is always words ---------- */
const URGENCY_TEXT: Record<Urgency, string> = {
  act: "Act",
  watch: "Watch",
  "on-track": "On track",
};

export function UrgencyLabel({ urgency, children }: { urgency: Urgency; children?: ReactNode }) {
  return <span className={`urgency u-${urgency}`}>{children ?? URGENCY_TEXT[urgency]}</span>;
}

/* ---------- Segmented (§7) ---------- */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Monogram + owner avatar ---------- */
export function Monogram({
  initials,
  bg,
  color,
  large = false,
}: {
  initials: string;
  bg: string;
  color: string;
  large?: boolean;
}) {
  return (
    <span className={`mg${large ? " lg" : ""}`} style={{ background: bg, color }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function OwnerAvatar({ person, large = false }: { person: Person; large?: boolean }) {
  return (
    <span
      className={`own${large ? " lg" : ""}`}
      style={{ background: person.avatarBg, color: person.avatarColor }}
      aria-label={`Owner ${person.name}`}
      role="img"
    >
      {person.initials}
    </span>
  );
}

/* ---------- Days-in-stage meter (10 pips, §13 "days-in-stage meter") ---------- */
export function AgeMeter({ days, amber = false }: { days: number; amber?: boolean }) {
  const filled = Math.min(10, Math.max(0, days));
  return (
    <span className="age" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < filled ? `on${amber ? " amber" : ""}` : undefined} />
      ))}
    </span>
  );
}
