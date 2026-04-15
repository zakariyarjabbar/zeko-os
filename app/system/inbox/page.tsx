// app/system/inbox/page.tsx
// Inbox — displays contact form submissions.
// List on left, detail + reply on right.

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, MailOpen, Trash2, Send, RefreshCw,
  ChevronLeft, AlertCircle, CheckCircle2, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/components/system/SessionContext";
import { canManageInbox } from "@/lib/permissions";
import { getAppCache } from "@/lib/app-cache";
import type { CachedInboxItem } from "@/lib/app-cache";

// ─── Types ────────────────────────────────────────────────────
type ContactMessage = CachedInboxItem;

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " · "
    + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Message list item ────────────────────────────────────────
function MessageItem({
  msg, active, onClick,
}: {
  msg: ContactMessage; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-zk-border/40",
        "transition-all duration-150 group",
        active
          ? "bg-zk-green/8 border-l-2 border-l-zk-green"
          : "border-l-2 border-l-transparent hover:bg-zk-green/4"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {msg.read
            ? <MailOpen size={11} className="text-zk-muted/50 shrink-0" />
            : <Mail size={11} className="text-zk-green shrink-0" />
          }
          <span className={cn(
            "font-mono text-[11px] truncate",
            msg.read ? "text-zk-slate" : "text-zk-white font-semibold"
          )}>
            {msg.name}
          </span>
        </div>
        <span className="font-mono text-[9px] text-zk-muted/50 shrink-0 mt-0.5">
          {new Date(msg.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </span>
      </div>
      <p className={cn(
        "font-mono text-[10px] truncate",
        msg.read ? "text-zk-muted/60" : "text-zk-slate"
      )}>
        {msg.subject}
      </p>
      <p className="font-mono text-[10px] text-zk-muted/40 truncate mt-0.5">
        {msg.email}
      </p>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function InboxPage() {
  const profile   = useProfile();
  const canManage = canManageInbox(profile.accessFlags);

  // ── Initialise from cache (instant), then refresh if stale ──
  const cache = getAppCache();
  const cached = cache.getInbox();

  const [messages,  setMessages]  = useState<ContactMessage[]>(cached ?? []);
  const [selected,  setSelected]  = useState<ContactMessage | null>(null);
  // Skip the loading skeleton when we already have cached data
  const [loading,   setLoading]   = useState(cached === null);
  const [deleting,  setDeleting]  = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending,   setSending]   = useState(false);
  const [replyStatus, setReplyStatus] = useState<"idle" | "ok" | "err" | "no-key">("idle");

  // ── Fetch — stale-while-revalidate ─────────────────────────
  const fetchMessages = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res  = await fetch("/api/inbox");
      const data = await res.json() as ContactMessage[];
      if (Array.isArray(data)) {
        cache.setInbox(data);
        setMessages(data);
      }
    } catch (e) {
      console.error("[inbox] fetch:", e);
    } finally {
      setLoading(false);
    }
  }, [cache]);

  useEffect(() => {
    // If we had cached data it was already shown — only fetch if stale
    if (!cache.isInboxFresh()) {
      fetchMessages(!cached);  // show spinner only on cold cache miss
    }

    // Re-sync whenever ShellPrefetcher updates the cache via SSE
    function onCacheUpdate() {
      const fresh = getAppCache().getInbox();
      if (fresh) setMessages(fresh);
    }
    window.addEventListener("zk:cache:inbox", onCacheUpdate);
    return () => window.removeEventListener("zk:cache:inbox", onCacheUpdate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Select + mark read ──────────────────────────────────────
  async function handleSelect(msg: ContactMessage) {
    setSelected(msg);
    setReplyText("");
    setReplyStatus("idle");

    if (!msg.read) {
      await fetch(`/api/inbox/read?id=${msg.id}`, { method: "PATCH" });
      // Update both local state and the cache
      getAppCache().patchInboxItem(msg.id, { read: true });
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, read: true } : m)
      );
      // Notify sidebar to refresh its unread count
      window.dispatchEvent(new CustomEvent("zk:cache:inbox"));
    }
  }

  // ── Delete ──────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeleting(true);
    await fetch(`/api/inbox?id=${id}`, { method: "DELETE" });
    // Update both local state and the cache
    getAppCache().removeInboxItem(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selected?.id === id) setSelected(null);
    setDeleting(false);
    // Notify sidebar
    window.dispatchEvent(new CustomEvent("zk:cache:inbox"));
  }

  // ── Reply ───────────────────────────────────────────────────
  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    setReplyStatus("idle");

    const res = await fetch("/api/inbox/reply", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        to:           selected.email,
        subject:      selected.subject,
        replyBody:    replyText.trim(),
        originalName: selected.name,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setReplyStatus(data.error?.includes("RESEND_API_KEY") ? "no-key" : "err");
    } else {
      setReplyStatus("ok");
      setReplyText("");
    }
    setSending(false);
  }

  const unread = messages.filter((m) => !m.read).length;

  // ── Empty state ─────────────────────────────────────────────
  if (!loading && messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Inbox size={32} className="text-zk-muted/30" />
        <p className="font-mono text-xs text-zk-muted/50 tracking-widest">NO MESSAGES</p>
        <button
          onClick={() => fetchMessages(true)}
          className="flex items-center gap-1.5 font-mono text-[10px] text-zk-muted/50 hover:text-zk-green transition-colors"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Message list ──────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-zk-border bg-zk-surface/30">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zk-border shrink-0">
          <div className="flex items-center gap-2">
            <Mail size={13} className="text-zk-green" />
            <span className="font-mono text-[11px] font-semibold text-zk-green tracking-widest uppercase">
              Inbox
            </span>
            {unread > 0 && (
              <span className="font-mono text-[9px] bg-zk-green text-zk-bg px-1.5 py-0.5 rounded-sm">
                {unread}
              </span>
            )}
          </div>
          <button
            onClick={() => fetchMessages(true)}
            className="text-zk-muted/50 hover:text-zk-green transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-zk-border/40 animate-pulse">
                  <div className="h-2.5 bg-zk-green/10 rounded w-1/2 mb-2" />
                  <div className="h-2 bg-zk-green/5 rounded w-3/4" />
                </div>
              ))
            : messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  active={selected?.id === msg.id}
                  onClick={() => handleSelect(msg)}
                />
              ))
          }
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col h-full"
            >
              {/* Message header */}
              <div className="shrink-0 px-6 py-4 border-b border-zk-border bg-zk-surface/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-mono text-sm font-semibold text-zk-white truncate mb-1">
                      {selected.subject}
                    </h2>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-[11px] text-zk-green">
                        {selected.name}
                      </span>
                      <span className="font-mono text-[11px] text-zk-muted/60">
                        &lt;{selected.email}&gt;
                      </span>
                      <span className="font-mono text-[10px] text-zk-muted/40">
                        {formatDate(selected.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Delete button — inbox-manager only */}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(selected.id)}
                      disabled={deleting}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-sm border",
                        "font-mono text-[10px] tracking-wider shrink-0",
                        "border-zk-red/30 bg-zk-red/5 text-zk-red",
                        "hover:bg-zk-red/15 hover:border-zk-red/60",
                        "disabled:opacity-40 disabled:pointer-events-none",
                        "transition-all duration-150"
                      )}
                    >
                      {deleting
                        ? <span className="w-3 h-3 border border-zk-red border-t-transparent rounded-full animate-spin" />
                        : <Trash2 size={11} />
                      }
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Message body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="font-mono text-[9px] text-zk-muted/40 tracking-[0.2em] uppercase mb-3">
                  // Message Payload
                </div>
                <div className="font-mono text-sm text-zk-slate leading-relaxed whitespace-pre-wrap border border-zk-border/30 rounded-sm bg-zk-surface/20 px-5 py-4">
                  {selected.message}
                </div>

                {/* Reply area — inbox-manager only */}
                {canManage && <div className="mt-6">
                  <div className="font-mono text-[9px] text-zk-muted/40 tracking-[0.2em] uppercase mb-3">
                    // Reply Transmission → {selected.email}
                  </div>

                  {/* Reply status */}
                  <AnimatePresence>
                    {replyStatus === "ok" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-sm border border-zk-green/20 bg-zk-green/5 font-mono text-[11px] text-zk-green"
                      >
                        <CheckCircle2 size={12} /> Email sent to {selected.email}
                      </motion.div>
                    )}
                    {replyStatus === "err" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-sm border border-zk-red/20 bg-zk-red/5 font-mono text-[11px] text-zk-red"
                      >
                        <AlertCircle size={12} /> Failed to send. Try again.
                      </motion.div>
                    )}
                    {replyStatus === "no-key" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-sm border border-zk-amber/20 bg-zk-amber/5 font-mono text-[11px] text-zk-amber"
                      >
                        <AlertCircle size={12} /> Add RESEND_API_KEY to .env.local to enable email replies.
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="border border-zk-border/40 rounded-sm bg-zk-surface/20 overflow-hidden focus-within:border-zk-green/40 transition-colors">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-zk-border/30">
                      <span className="font-mono text-[10px] text-zk-green/60 select-none">
                        reply@zeko:~$
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      className={cn(
                        "w-full bg-transparent px-4 py-3 outline-none resize-none",
                        "font-mono text-sm text-zk-white leading-relaxed",
                        "placeholder:text-zk-muted/30"
                      )}
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleReply}
                      disabled={sending || !replyText.trim()}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-sm border",
                        "font-mono text-xs tracking-wider",
                        "border-zk-green/40 bg-zk-green/8 text-zk-green",
                        "hover:bg-zk-green/15 hover:border-zk-green",
                        "disabled:opacity-40 disabled:pointer-events-none",
                        "transition-all duration-150"
                      )}
                    >
                      {sending
                        ? <span className="w-3 h-3 border border-zk-green border-t-transparent rounded-full animate-spin" />
                        : <Send size={11} />
                      }
                      {sending ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </div>}

                {/* View-only notice for non-managers */}
                {!canManage && (
                  <div className="mt-6 px-4 py-3 rounded-sm border border-dashed border-zk-border/40">
                    <p className="font-mono text-[10px] text-zk-muted/40 tracking-widest text-center">
                      VIEW ONLY — inbox-manager permission required to reply or delete
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-3"
            >
              <MailOpen size={28} className="text-zk-muted/20" />
              <p className="font-mono text-[11px] text-zk-muted/40 tracking-widest">
                SELECT A MESSAGE
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
