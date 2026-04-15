// lib/app-cache.ts
// Shell-level cache — inbox list and roles list.
//
// Companion to chat-cache.ts (which owns channels + DMs).
// AppCacheStore is a window singleton, populated once by ShellPrefetcher
// at system open, then kept fresh by the /api/stream/events SSE.
//
// TTLs are intentionally longer than chat data because this data is
// structural (slow-changing): inbox items and role definitions.
//
// sessionStorage persistence: data survives in-app navigation and
// same-tab refreshes. Cleared when the tab closes.

// ── Configuration ────────────────────────────────────────────────────────────

/** Inbox list stays fresh for 60 s between background re-fetches. */
const INBOX_FRESH_MS  = 60_000;

/** Roles list stays fresh for 2 min — role structure changes rarely. */
const ROLES_FRESH_MS  = 120_000;

// ── Types ────────────────────────────────────────────────────────────────────

interface Stamped<T> {
  data:      T;
  fetchedAt: number;
}

export interface CachedInboxItem {
  id:         string;
  name:       string;
  email:      string;
  subject:    string;
  message:    string;
  read:       boolean;
  created_at: string;
}

export interface CachedRole {
  id:          string;
  name:        string;
  description: string;
  permissions: string[];
  created_at:  string;
  userCount:   number;
}

// ── AppCacheStore ────────────────────────────────────────────────────────────

class AppCacheStore {
  private inbox: Stamped<CachedInboxItem[]> | null = null;
  private roles: Stamped<CachedRole[]>      | null = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static now()                           { return Date.now(); }
  private static fresh(ts: number, ttl: number)  { return AppCacheStore.now() - ts < ttl; }

  // ── Inbox ─────────────────────────────────────────────────────────────────

  getInbox(): CachedInboxItem[] | null {
    return this.inbox?.data ?? null;
  }

  isInboxFresh(): boolean {
    return !!this.inbox && AppCacheStore.fresh(this.inbox.fetchedAt, INBOX_FRESH_MS);
  }

  setInbox(data: CachedInboxItem[]): void {
    this.inbox = { data, fetchedAt: AppCacheStore.now() };
    this.persist("inbox", data);
  }

  /** Merge a single new item at the front without a full re-fetch. */
  prependInboxItem(item: CachedInboxItem): void {
    const existing = this.inbox?.data ?? [];
    this.setInbox([item, ...existing]);
  }

  /** Update a single item in the inbox (e.g., mark as read). */
  patchInboxItem(id: string, patch: Partial<CachedInboxItem>): void {
    if (!this.inbox) return;
    this.setInbox(this.inbox.data.map((m) => m.id === id ? { ...m, ...patch } : m));
  }

  /** Remove a single item from the inbox cache. */
  removeInboxItem(id: string): void {
    if (!this.inbox) return;
    this.setInbox(this.inbox.data.filter((m) => m.id !== id));
  }

  /**
   * Mark the inbox as stale so the next consumer triggers a background fetch.
   * Does NOT clear the data — stale data is still shown until the fetch lands.
   */
  invalidateInbox(): void {
    if (this.inbox) this.inbox.fetchedAt = 0;
  }

  // ── Roles ─────────────────────────────────────────────────────────────────

  getRoles(): CachedRole[] | null {
    return this.roles?.data ?? null;
  }

  isRolesFresh(): boolean {
    return !!this.roles && AppCacheStore.fresh(this.roles.fetchedAt, ROLES_FRESH_MS);
  }

  setRoles(data: CachedRole[]): void {
    this.roles = { data, fetchedAt: AppCacheStore.now() };
    this.persist("roles", data);
  }

  invalidateRoles(): void {
    if (this.roles) this.roles.fetchedAt = 0;
  }

  // ── sessionStorage ────────────────────────────────────────────────────────

  private persist<T>(key: string, data: T): void {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        `zk:app:${key}`,
        JSON.stringify({ data, fetchedAt: AppCacheStore.now() } satisfies Stamped<T>),
      );
    } catch {
      // Quota exceeded or private-browsing — silently ignore
    }
  }

  private loadFromSession<T>(key: string): Stamped<T> | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(`zk:app:${key}`);
      return raw ? (JSON.parse(raw) as Stamped<T>) : null;
    } catch {
      return null;
    }
  }

  /**
   * Populate in-memory cache from sessionStorage.
   * Call once before the first fetch — shows instant stale data while
   * the network request is in-flight.
   * Safe to call repeatedly (no-ops when memory is already populated).
   */
  hydrate(): void {
    if (typeof window === "undefined") return;

    if (!this.inbox) {
      const e = this.loadFromSession<CachedInboxItem[]>("inbox");
      if (e) this.inbox = e;
    }

    if (!this.roles) {
      const e = this.loadFromSession<CachedRole[]>("roles");
      if (e) this.roles = e;
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────
// Stored on `window` so Next.js HMR re-executions never wipe live data.

const WIN_KEY = "__zk_app_cache_v1__";

export function getAppCache(): AppCacheStore {
  if (typeof window === "undefined") return new AppCacheStore();
  const w = window as unknown as Record<string, unknown>;
  if (!w[WIN_KEY]) w[WIN_KEY] = new AppCacheStore();
  return w[WIN_KEY] as AppCacheStore;
}

export type { AppCacheStore };
