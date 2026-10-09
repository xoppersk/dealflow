"use client";

/** Greeting header: "Good morning, Maya" + full date, computed in local time. */
export function Greeting({ name }: { name: string }) {
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Good {part}, {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{date}</p>
    </div>
  );
}
