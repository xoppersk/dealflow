/**
 * Dealflow brand mark — three staggered ascending bars + the wordmark.
 * Sizes scale the SVG and the type together.
 */

const BAR_HEIGHTS = [10, 16, 22];

export function BrandMark({ size = 32 }: { size?: number }) {
  const fontSize = Math.round(size * 0.62);
  return (
    <span className="inline-flex items-center gap-2" aria-label="Dealflow">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="df-bars" x1="4" y1="28" x2="28" y2="4">
            <stop offset="0" stopColor="#14b8a6" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
        {BAR_HEIGHTS.map((h, i) => (
          <rect
            key={i}
            x={4 + i * 9}
            y={28 - h}
            width={6.5}
            height={h}
            rx={2}
            fill="url(#df-bars)"
          />
        ))}
      </svg>
      <span
        className="font-semibold tracking-tight text-foreground"
        style={{ fontSize }}
      >
        Dealflow
      </span>
    </span>
  );
}
