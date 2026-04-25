// components/system/chat/CliInput.tsx
// Message input with:
//   • onTyping callback (fired on each keystroke — parent debounces)
//   • @mention autocomplete — searches /api/chat/users-search on "@word" patterns

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_CHARS = 2000;

// ─── @mention autocomplete ────────────────────────────────────

interface MentionResult {
  id:       string;
  username: string;
  name:     string;
  status:   string;
}

/** Find the @word fragment immediately before the cursor, if any. */
function getMentionQuery(value: string, cursorPos: number): string | null {
  const before = value.slice(0, cursorPos);
  const match  = before.match(/@([a-z0-9_-]*)$/i);
  return match ? match[1] : null;
}

/** Replace the @partial before the cursor with @username. */
function applyMention(value: string, cursorPos: number, username: string): string {
  const before = value.slice(0, cursorPos);
  const after  = value.slice(cursorPos);
  const replaced = before.replace(/@([a-z0-9_-]*)$/i, `@${username} `);
  return replaced + after;
}

// ─── Props ────────────────────────────────────────────────────

interface CliInputProps {
  channelLabel: string;
  username:     string;
  onSend:       (text: string) => void;
  onTyping?:    () => void;
  disabled?:    boolean;
}

export function CliInput({ channelLabel, username, onSend, onTyping, disabled }: CliInputProps) {
  const [value,    setValue]    = useState("");
  const [focused,  setFocused]  = useState(false);
  const [mentions, setMentions] = useState<MentionResult[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const inputRef   = useRef<HTMLInputElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [channelLabel]);

  // ── @mention lookup ────────────────────────────────────────
  const lookupMentions = useCallback(async (q: string) => {
    if (q.length === 0) {
      setMentions([]);
      return;
    }
    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res  = await fetch(`/api/chat/users-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      const data = await res.json() as MentionResult[];
      if (Array.isArray(data)) {
        setMentions(data.slice(0, 6));
        setMentionIdx(0);
      }
    } catch {
      // aborted or network error — ignore
    }
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.slice(0, MAX_CHARS);
    setValue(v);
    onTyping?.();

    const cursor = e.target.selectionStart ?? v.length;
    const q      = getMentionQuery(v, cursor);
    if (q !== null) {
      lookupMentions(q);
    } else {
      setMentions([]);
    }
  }

  function selectMention(m: MentionResult) {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const next   = applyMention(value, cursor, m.username);
    setValue(next.slice(0, MAX_CHARS));
    setMentions([]);
    // Move cursor to after the inserted mention + space
    const newPos = cursor - getMentionQuery(value, cursor)!.length - 1 + m.username.length + 2;
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Mention dropdown navigation
    if (mentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % mentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + mentions.length) % mentions.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        selectMention(mentions[mentionIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMentions([]);
        return;
      }
    }

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
    setMentions([]);
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
      {/* @mention dropdown */}
      {mentions.length > 0 && (
        <div className={cn(
          "mx-4 mb-1 border border-zk-border/60 rounded-sm overflow-hidden",
          "bg-zk-surface shadow-lg",
        )}>
          {mentions.map((m, i) => (
            <button
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); selectMention(m); }}
              className={cn(
                "w-full text-left px-3 py-1.5 flex items-center gap-2",
                "font-sans text-xs transition-colors",
                i === mentionIdx
                  ? "bg-zk-green/10 text-zk-green"
                  : "text-zk-white/70 hover:bg-zk-border/20",
              )}
            >
              <span className="font-semibold">@{m.username}</span>
              {m.status === "ONLINE" && (
                <span className="w-1.5 h-1.5 rounded-full bg-zk-green shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-0 px-4 py-2.5">
        <div className="flex items-center gap-1.5 shrink-0 mr-3 select-none">
          <span className="font-sans text-sm text-zk-muted/50">{username}</span>
          <span className={cn(
            "text-[13px] transition-colors",
            focused ? "text-zk-green" : "text-zk-muted/40"
          )}>▸</span>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Message input"
          placeholder={focused ? "" : `Message ${channelLabel}…`}
          className={cn(
            "flex-1 bg-transparent outline-none border-none",
            "font-sans text-sm text-zk-white caret-zk-green",
            "placeholder:text-zk-muted/25",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        />

        <div className="shrink-0 flex items-center gap-2 ml-2">
          {hasContent && (
            <span className={cn(
              "font-sans text-xs tabular-nums transition-colors",
              overLimit  ? "text-zk-red"     :
              nearLimit  ? "text-zk-amber/70" :
                           "text-zk-muted/30"
            )}>
              {charCount}/{MAX_CHARS}
            </span>
          )}
          <button
            onClick={submit}
            disabled={!hasContent || disabled || overLimit}
            aria-label="Send message"
            className={cn(
              "p-1.5 rounded border transition-all duration-150",
              hasContent && !overLimit
                ? "border-zk-green/30 text-zk-green bg-zk-green/8 hover:bg-zk-green/15 hover:border-zk-green/60"
                : "border-transparent text-zk-muted/20 pointer-events-none",
            )}
          >
            <Send size={12} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-2 flex items-center gap-3">
        <span className="font-sans text-xs text-zk-muted/20 select-none">
          Enter to send  ·  Esc to cancel  ·  @ to mention
        </span>
      </div>
    </div>
  );
}
