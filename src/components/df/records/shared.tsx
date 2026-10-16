import Link from "next/link";
import type { CSSProperties } from "react";
import type { RichPart, Tone } from "@/lib/df/records-data";

/** Chip fills exactly as drawn on the Records screens (inline in the HTML). */
export const CHIP_STYLES: Record<string, CSSProperties> = {
  strong: { background: "#E3EFEC", color: "#0F6B62" },
  good: { background: "#F1EEE6", color: "#44504D" },
  new: { background: "#E3EAF6", color: "#23407A" },
  cooling: { background: "#FBF1E2", color: "#9A5B00" },
  watch: { background: "#FBF1E2", color: "#9A5B00" },
  act: { background: "#FBE7E4", color: "#B4261A" },
  "on-track": { background: "#E3EFEC", color: "#0F6B62" },
  neutral: { background: "#F1EEE6", color: "#44504D" },
  ok: { background: "#E3EFEC", color: "#0F6B62" },
};

export function ToneChip({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="chip" style={CHIP_STYLES[tone]}>
      <i />
      {label}
    </span>
  );
}

/** Renders the screen-drawn rich sentences (R-03 standing / R-05 one line). */
export function RichText({ parts }: { parts: RichPart[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "mono") {
          return (
            <span key={i} className="mono">
              {p.text}
            </span>
          );
        }
        if (p.kind === "bold") {
          return (
            <b key={i} style={{ fontWeight: 600, color: "#17201E" }}>
              {p.text}
            </b>
          );
        }
        if (p.kind === "link" && p.href) {
          return (
            <Link key={i} href={p.href}>
              {p.text}
            </Link>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
