// components/system/chat/CliInput.tsx
// Redesigned terminal input.
// Shows username prompt, character count, send button on non-empty.

"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_CHARS = 2000;

interface CliInputProps {
  channelLabel: string;
  username:     string;
  onSend:       (text: string) => void;
  disabled?:    boolean;
}

export function CliInput({ channelLabel, username, onSend, disabled }: CliInputProps) {
  const [value,   setValue]   = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [channelLabel]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "Escape") {
      setValue("");
      inputRef.current?.blur();
    }
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  const charCount  = value.length;
  const nearLimit  = charCount > MAX_CHARS * 0.8;
  const overLimit  = charCount >= MAX_CHARS;
  const hasContent = value.trim().length > 0;

  return (
    <div
      className={cn(
        "shrink-0 border-t transition-colors duration-150",
        focused
          ? "border-zk-green/20 bg-zk-green/[0.015]"
          : "border-zk-border/60 bg-[rgba(13,17,23,0.4)]",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Input row */}
      <div className="flex items-center gap-0 px-4 py-2.5">
        {/* Prompt */}
        <div className="flex items-center gap-1.5 shrink-0 mr-3 select-none">
          <span className="font-mono text-[11px] text-zk-green/60">
            {username}
          </span>
          <span className={cn(
            "font-mono text-[13px] transition-colors",
            focused ? "text-zk-green" : "text-zk-muted/40"
          )}>
            ▸
          </span>
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Message input"
          placeholder={focused ? "" : `Message ${channelLabel}...`}
          className={cn(
            "flex-1 bg-transparent outline-none border-none",
            "font-mono text-[12px] text-zk-white caret-zk-green",
            "placeholder:text-zk-muted/25",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        />

        {/* Right side — char count + send button */}
        <div className="shrink-0 flex items-center gap-2 ml-2">
          {/* Char counter — only when typing */}
          {hasContent && (
            <span className={cn(
              "font-mono text-[9px] tabular-nums transition-colors",
              overLimit  ? "text-zk-red"      :
              nearLimit  ? "text-zk-amber/70"  :
                           "text-zk-muted/30"
            )}>
              {charCount}/{MAX_CHARS}
            </span>
          )}

          {/* Send button */}
          <button
            onClick={submit}
            disabled={!hasContent || disabled || overLimit}
            aria-label="Send message"
            className={cn(
              "p-1.5 rounded-sm border transition-all duration-150",
              hasContent && !overLimit
                ? "border-zk-green/30 text-zk-green bg-zk-green/8 hover:bg-zk-green/15 hover:border-zk-green/60"
                : "border-transparent text-zk-muted/20 pointer-events-none",
            )}
          >
            <Send size={12} />
          </button>
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-4 pb-2 flex items-center gap-3">
        <span className="font-mono text-[9px] text-zk-muted/20 tracking-widest select-none">
          ENTER to send &nbsp;·&nbsp; ESC to cancel &nbsp;·&nbsp; E2E encrypted
        </span>
      </div>
    </div>
  );
}
