/**
 * Dealflow brand mark — three staggered bars ascending left to right
 * (a pipeline abstracted), single color, next to the wordmark in
 * Newsreader 600. Legible at 16px.
 */

export function BrandMark({
  size = 32,
  color = "#0f766e",
  wordmark = true,
}: {
  size?: number;
  /** Single bar color — teal on paper, cream/gold on the dark rail. */
  color?: string;
  wordmark?: boolean;
}) {
  const fontSize = Math.round(size * 0.62);
  return (
    <span className="inline-flex items-center gap-2" aria-label="Dealflow">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        aria-hidden="true"
      >
        <path
          d="M4 18h4V8H4v10Zm6 0h4V4h-4v14Zm6 0h4v-7h-4v7Z"
          fill={color}
        />
      </svg>
      {wordmark && (
        <span
          className="font-display font-semibold tracking-tight"
          style={{ fontSize, color }}
        >
          Dealflow
        </span>
      )}
    </span>
  );
}
