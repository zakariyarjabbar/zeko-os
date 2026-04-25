// lib/chat-cache.ts
// Discord-style client-side chat cache.
//
// Architecture mirrors Discord's internal message stores:
//   • Per-channel LRU message cache (max 50 channels × 200 messages)
//   • Separate metadata caches for the channel list and DM conversation list
//   • Presence map with its own TTL
//   • sessionStorage persistence for metadata (survives in-app navigation)
//   • Window-singleton so Next.js hot-module-reload never wipes in-flight data
//
// Usage:
//   const cache = getChatCache();   // stable singleton — safe to call inline
//   cache.getMessages("ch:global-ops")
//   cache.mergeMessages("ch:global-ops", incomingArray)

import type { Channel, ChatMessage, DMConversation } from "@/components/system/chat/types";

// ── Configuration ────────────────────────────────────────────────────────────

/** How many distinct channels/DMs to keep in memory before evicting oldest. */
const MAX_CACHED_CHANNELS    = 50;

/** Messages trimmed to this cap when a channel's store would exceed it. */
const MAX_MESSAGES_PER_CHAN  = 200;

/**
 * A message store is "fresh" for this many ms after its last network fetch.
 * Used to skip redundant background fetches on rapid channel switches.
 * Polling always runs regardless — this only gates `loadMessages`.
 */
const MSG_FRESH_MS           = 10_000;  // 10 s

/**
 * Channel-list and DM-conversation-list are "fresh" for 30 s.
 * Background refetches are skipped when in window; manual hard-reloads always bypass.
 */
const META_FRESH_MS          = 30_000;  // 30 s

/** Presence data TTL — matches the heartbeat interval. */
const PRESENCE_FRESH_MS      = 20_000;  // 20 s

// ── Internal types ───────────────────────────────────────────────────────────

interface Stamped<T> {
  data:      T;
  fetchedAt: number; // Date.now()
}

export type PresenceMap = Record<string, "ONLINE" | "OFFLINE">;

// ── ChatCacheStore ───────────────────────────────────────────────────────────

class ChatCacheStore {
  /**
   * Message cache keyed by cacheKey() — e.g. "ch:global-ops" or "dm:user-uuid".
   * Map preserves insertion order which gives us cheap LRU (delete + re-insert = "touch").
   */
  private msgs = new Map<string, Stamped<ChatMessage[]>>();

  private chans: Stamped<Channel[]>        | null = null;
  private dms:   Stamped<DMConversation[]> | null = null;
  private pres:  Stamped<PresenceMap>      | null = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static now()                              { return Date.now(); }
  private static fresh(ts: number, ttl: number)     { return ChatCacheStore.now() - ts < ttl; }

  // ── Message cache ─────────────────────────────────────────────────────────

  /**
   * Returns cached messages for `key`, or `null` on a cache miss.
   * Internally "touches" the entry (LRU promotion).
   */
  getMessages(key: string): ChatMessage[] | null {
    const e = this.msgs.get(key);
    if (!e) return null;
    // LRU touch: delete + re-insert moves to end (most-recently-used)
    this.msgs.delete(key);
    this.msgs.set(key, e);
    return e.data;
  }

  /**
   * True if the cache for `key` was populated within MSG_FRESH_MS.
   * Use this to skip redundant background fetches on channel switch.
   */
  isMessagesFresh(key: string): boolean {
    const e = this.msgs.get(key);
    return !!e && ChatCacheStore.fresh(e.fetchedAt, MSG_FRESH_MS);
  }

  /**
   * Overwrite the entire message list for `key` (used on initial load or hard refresh).
   * Trims to MAX_MESSAGES_PER_CHAN and applies LRU eviction if needed.
   */
  setMessages(key: string, msgs: ChatMessage[]): void {
    this.evictOldestIfFull();
    this.msgs.delete(key); // remove → re-insert = move to end (most-recent)
    this.msgs.set(key, {
      data:      msgs.slice(-MAX_MESSAGES_PER_CHAN),
      fetchedAt: ChatCacheStore.now(),
    });
  }

  /**
   * Merge `incoming` into the existing cache for `key`.
   *   • Only truly new IDs are appended (no duplicates).
   *   • If nothing new arrived, `fetchedAt` is still bumped.
   *   • Returns `{ changed: true }` if React state needs updating.
   *
   * This is the method to call from the polling loop.
   */
  mergeMessages(key: string, incoming: ChatMessage[]): { changed: boolean } {
    const e = this.msgs.get(key);
    if (!e) {
      // Cold path: no cache yet — treat like a full set
      this.setMessages(key, incoming);
      return { changed: true };
    }

    const existingIds = new Set(e.data.map((m) => m.id));
    const brandNew    = incoming.filter((m) => !existingIds.has(m.id));

    if (brandNew.length === 0) {
      // Bump the timestamp even when nothing new — prevents thrashing on idle channels
      e.fetchedAt = ChatCacheStore.now();
      return { changed: false };
    }

    const merged = [...e.data, ...brandNew].slice(-MAX_MESSAGES_PER_CHAN);
    // Re-insert to promote in LRU order
    this.msgs.delete(key);
    this.msgs.set(key, { data: merged, fetchedAt: ChatCacheStore.now() });
    return { changed: true };
  }

  /**
   * Add a single confirmed message to the cache (used after POST succeeds).
   * Safe to call even if the message is already there (idempotent via mergeMessages).
   */
  addConfirmedMessage(key: string, msg: ChatMessage): void {
    this.mergeMessages(key, [msg]);
  }

  /** Remove a message from the cache (optimistic delete). */
  removeMessage(key: string, msgId: string): void {
    const e = this.msgs.get(key);
    if (!e) return;
    e.data = e.data.filter((m) => m.id !== msgId);
  }

  /** Patch fields on an existing cached message (edit, read-receipt, etc.). */
  patchMessage(key: string, msgId: string, patch: Partial<ChatMessage>): void {
    const e = this.msgs.get(key);
    if (!e) return;
    const idx = e.data.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    e.data[idx] = { ...e.data[idx], ...patch };
  }

  /** Evict the least-recently-used channel if we've hit the cap. */
  private evictOldestIfFull(): void {
    if (this.msgs.size < MAX_CACHED_CHANNELS) return;
    // First key in Map = oldest (LRU)
    const oldest = this.msgs.keys().next().value as string | undefined;
    if (oldest) this.msgs.delete(oldest);
  }

  // ── Channel list ──────────────────────────────────────────────────────────

  getChannels(): Channel[] | null {
    return this.chans?.data ?? null;
  }

  isChannelsFresh(): boolean {
    return !!this.chans && ChatCacheStore.fresh(this.chans.fetchedAt, META_FRESH_MS);
  }

  setChannels(data: Channel[]): void {
    this.chans = { data, fetchedAt: ChatCacheStore.now() };
    this.persist("chs", data);
  }

  /**
   * Mark the channel list as stale so the next consumer triggers a background
   * re-fetch. The data itself is kept so the UI doesn't flash empty.
   */
  invalidateChannels(): void {
    if (this.chans) this.chans.fetchedAt = 0;
  }

  // ── DM conversation list ──────────────────────────────────────────────────

  getDmConvos(): DMConversation[] | null {
    return this.dms?.data ?? null;
  }

  isDmConvosFresh(): boolean {
    return !!this.dms && ChatCacheStore.fresh(this.dms.fetchedAt, META_FRESH_MS);
  }

  setDmConvos(data: DMConversation[]): void {
    this.dms = { data, fetchedAt: ChatCacheStore.now() };
    this.persist("dmc", data);
  }

  /**
   * Mark the DM conversation list as stale — triggers a background re-fetch
   * on the next consumer call without clearing the displayed list.
   */
  invalidateDmConvos(): void {
    if (this.dms) this.dms.fetchedAt = 0;
  }

  // ── Presence map ──────────────────────────────────────────────────────────

  getPresence(): PresenceMap | null {
    return this.pres?.data ?? null;
  }

  isPresenceFresh(): boolean {
    return !!this.pres && ChatCacheStore.fresh(this.pres.fetchedAt, PRESENCE_FRESH_MS);
  }

  /**
   * Merge a partial presence update into the existing map without losing unrelated keys.
   * Always replaces the full map when the API returns the complete set.
   */
  setPresence(data: PresenceMap): void {
    // Merge into existing to avoid losing keys for users not in the latest batch
    const merged = { ...(this.pres?.data ?? {}), ...data };
    this.pres = { data: merged, fetchedAt: ChatCacheStore.now() };
  }

  // ── sessionStorage ────────────────────────────────────────────────────────

  private persist<T>(key: string, data: T): void {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        `zk:chat:${key}`,
        JSON.stringify({ data, fetchedAt: ChatCacheStore.now() } satisfies Stamped<T>),
      );
    } catch {
      // Quota exceeded or private-browsing restriction — silently ignore
    }
  }

  private loadFromSession<T>(key: string): Stamped<T> | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(`zk:chat:${key}`);
      return raw ? (JSON.parse(raw) as Stamped<T>) : null;
    } catch {
      return null;
    }
  }

  /**
   * Populate the in-memory cache from sessionStorage.
   *
   * Call exactly once, before the first fetch, so the UI can show
   * stale-but-instant data while the network request is in-flight.
   * Harmless to call again — no-ops if memory already populated.
   *
   * sessionStorage survives same-tab reloads and in-app navigation
   * (Next.js router pushes) but is cleared when the tab closes.
   */
  hydrate(): void {
    if (typeof window === "undefined") return;

    if (!this.chans) {
      const e = this.loadFromSession<Channel[]>("chs");
      if (e) this.chans = e;
    }

    if (!this.dms) {
      const e = this.loadFromSession<DMConversation[]>("dmc");
      if (e) this.dms = e;
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────
// Stored on `window` under a private key so Next.js fast-refresh / HMR
// module re-execution never creates a second instance and wipes the cache.

const WIN_KEY = "__zk_chat_cache_v1__";

export function getChatCache(): ChatCacheStore {
  // SSR guard — route handlers and server components should never reach this
  if (typeof window === "undefined") return new ChatCacheStore();

  const w = window as unknown as Record<string, unknown>;
  if (!w[WIN_KEY]) w[WIN_KEY] = new ChatCacheStore();
  return w[WIN_KEY] as ChatCacheStore;
}

// Re-export the class type for consumers that want to annotate their refs
export type { ChatCacheStore };
