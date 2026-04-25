// components/system/chat/TypingIndicator.tsx
// Shows "X is typing..." or "X, Y are typing..." below the message log.
// Receives the live list of active typers; the parent is responsible for
// expiring stale entries (TTL-based cleanup in page.tsx).

"use client";

import { type TypingUser } from "./types";

interface TypingIndicatorProps {
  typers: TypingUser[];
}

export function TypingIndicator({ typers }: TypingIndicatorProps) {
  if (typers.length === 0) return null;

  const names = typers.map((t) => t.handle || "someone");
  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing…`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing…`;
  } else {
    label = `${names[0]}, ${names[1]} and ${names.length - 2} more are typing…`;
  }

  return (
    <div className="shrink-0 px-4 pb-1 h-5 flex items-center">
      <span className="font-sans text-xs text-zk-muted/40 italic select-none">
        {label}
      </span>
    </div>
  );
}
