// components/system/chat/CliInput.tsx
// Terminal-style message input.
// Prefix: root@zeko-os:<channel>:~$
// Enter sends, Escape clears, blinking cursor when field is empty.

"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CliInputProps {
  channelLabel: string;
  onSend: (text: string) => void;
}

export function CliInput({ channelLabel, onSend }: CliInputProps) {
  const [value, setValue]         = useState("");
  const [focused, setFocused]     = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Focus the input whenever the channel changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [channelLabel]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (trimmed) {
        onSend(trimmed);
        setValue("");
      }
      return;
    }
    if (e.key === "Escape") {
      setValue("");
    }
  }

  const prompt = `root@zeko-os:${channelLabel}:~$`;

  return (
    <div
      className={cn(
        "shrink-0 border-t border-zk-border px-4 py-2.5 bg-zk-surface/20",
        "transition-colors duration-150",
        focused && "bg-zk-green/[0.02]"
      )}
      // Clicking anywhere in the bar focuses the input
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center gap-2">
        {/* Prompt prefix */}
        <span className="font-mono text-xs text-zk-green/70 whitespace-nowrap select-none shrink-0">
          {prompt}
        </span>

        {/* Input */}
        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Message input"
            className={cn(
              "w-full bg-transparent outline-none border-none",
              "font-mono text-xs text-zk-white caret-zk-green",
              "placeholder:text-zk-muted/30",
            )}
            placeholder={focused ? "" : "type a message and press enter..."}
          />


        </div>
      </div>

      {/* Hint row */}
      <div className="mt-1 font-mono text-[9px] text-zk-muted/30 tracking-widest select-none">
        ENTER to send &nbsp;·&nbsp; ESC to clear &nbsp;·&nbsp; E2E encrypted
      </div>
    </div>
  );
}
