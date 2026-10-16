/** Inline SVG icons — small strokes (1.5–1.8px), no icon fonts (DS Premium v2). */

export function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  );
}

export function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 1.5v9M1.5 6h9" />
    </svg>
  );
}

export function CheckIcon({ size = 10, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <path d="m2.5 6.5 2.3 2.3 4.7-5" />
    </svg>
  );
}

export function ClockWatchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="#9A5B00" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}

export function AlertIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="#B4261A" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v3.6M8 10.8v.4" />
    </svg>
  );
}

export function PulseIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="#9A5B00" strokeWidth="1.6" aria-hidden="true">
      <path d="M2.5 8h3l1.5-3 2 6 1.5-3h3" />
    </svg>
  );
}

/** The bar-chart brand mark (§13 signature), exactly as drawn in the header. */
export function BrandMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="9" width="3" height="5.5" rx="1" fill="#5FB3A9" />
      <rect x="6.5" y="6" width="3" height="8.5" rx="1" fill="#8FD0C7" />
      <rect x="11.5" y="2" width="3" height="12.5" rx="1" fill="#FFFFFF" />
    </svg>
  );
}
