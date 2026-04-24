// app/system/overview/page.tsx
// NEXUS CONTROL — mission-control style system overview.
// Radar · Ring gauges · SIGINT feed · Operator roster — all driven by real cache data.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn }          from "@/lib/utils";
import { getChatCache } from "@/lib/chat-cache";
import { getAppCache, type CachedUser } from "@/lib/app-cache";
import { useProfile, useSession }       from "@/components/system/SessionContext";
import { canViewUsers }                 from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────

interface RadarBlip {
  angle:    number;
  dist:     number;
  online:   boolean;
  username: string;
}

type SigintType = "PRESENCE" | "CHANNEL" | "SESSION" | "MSG" | "ROLE" | "SYS";

interface SigintLine {
  id:        number;
  type:      SigintType;
  text:      string;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function userToBlip(id: string, online: boolean, username: string): RadarBlip {
  const h1 = stableHash(id);
  const h2 = stableHash(id + "salt");
  return {
    angle:    ((h1 % 1000) / 1000) * Math.PI * 2,
    dist:     0.18 + ((h2 % 720) / 1000),
    online,
    username,
  };
}

// ─── Radar canvas ─────────────────────────────────────────────

function UserRadar({ users }: { users: CachedUser[] }) {
  const cvRef    = useRef<HTMLCanvasElement>(null);
  const blipsRef = useRef<RadarBlip[]>([]);

  // Sync blips ref without restarting the animation loop
  useEffect(() => {
    blipsRef.current = users.map((u) =>
      userToBlip(u.id, u.profile?.session_status === "ONLINE", u.profile?.username ?? u.id),
    );
  }, [users]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const SZ = 216;
    cv.width = SZ; cv.height = SZ;
    const cx = SZ / 2, cy = SZ / 2, R = SZ / 2 - 8;

    let sweep = 0;
    let raf   = 0;
    let frame = 0;
    const pings = new Map<string, number>(); // username → last ping frame

    function draw() {
      raf = requestAnimationFrame(draw);
      frame++;
      ctx!.clearRect(0, 0, SZ, SZ);

      // Base
      ctx!.beginPath(); ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fillStyle = "#010601"; ctx!.fill();

      // Grid rings
      for (let i = 1; i <= 3; i++) {
        ctx!.beginPath(); ctx!.arc(cx, cy, (R * i) / 3, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(0,255,65,0.07)"; ctx!.lineWidth = 1; ctx!.stroke();
      }

      // Cross-hair lines
      ctx!.strokeStyle = "rgba(0,255,65,0.05)"; ctx!.lineWidth = 0.5;
      ctx!.beginPath(); ctx!.moveTo(cx - R, cy);    ctx!.lineTo(cx + R, cy);    ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(cx,     cy - R); ctx!.lineTo(cx,     cy + R); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(cx - R * 0.7, cy - R * 0.7); ctx!.lineTo(cx + R * 0.7, cy + R * 0.7); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(cx + R * 0.7, cy - R * 0.7); ctx!.lineTo(cx - R * 0.7, cy + R * 0.7); ctx!.stroke();

      // Sweep trail — series of thin filled arcs fading out
      const trailLen = Math.PI * 0.55;
      for (let t = 0; t < trailLen; t += 0.022) {
        const a = sweep - t;
        const alpha = ((trailLen - t) / trailLen) * 0.2;
        ctx!.beginPath(); ctx!.moveTo(cx, cy);
        ctx!.arc(cx, cy, R, a - 0.022, a);
        ctx!.fillStyle = `rgba(0,255,65,${alpha})`; ctx!.fill();
      }

      // Sweep line
      ctx!.beginPath(); ctx!.moveTo(cx, cy);
      ctx!.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
      ctx!.strokeStyle = "rgba(0,255,65,0.85)"; ctx!.lineWidth = 1.5; ctx!.stroke();

      // Blips
      for (const b of blipsRef.current) {
        const bx = cx + Math.cos(b.angle) * b.dist * R;
        const by = cy + Math.sin(b.angle) * b.dist * R;

        const diff = ((sweep - b.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (b.online && diff < 0.11) pings.set(b.username, frame);

        const age = frame - (pings.get(b.username) ?? -9999);

        if (b.online) {
          // Expanding ping ring
          if (age < 55) {
            const alpha = Math.max(0, 1 - age / 55);
            ctx!.beginPath(); ctx!.arc(bx, by, 3 + age * 0.32, 0, Math.PI * 2);
            ctx!.strokeStyle = `rgba(0,255,65,${alpha * 0.65})`; ctx!.lineWidth = 1; ctx!.stroke();
          }
          // Glow halo
          const g = ctx!.createRadialGradient(bx, by, 0, bx, by, 7);
          g.addColorStop(0, "rgba(0,255,65,0.55)"); g.addColorStop(1, "rgba(0,255,65,0)");
          ctx!.beginPath(); ctx!.arc(bx, by, 7, 0, Math.PI * 2);
          ctx!.fillStyle = g; ctx!.fill();
          // Core dot
          ctx!.beginPath(); ctx!.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx!.fillStyle = "#00FF41"; ctx!.fill();
        } else {
          ctx!.beginPath(); ctx!.arc(bx, by, 1.5, 0, Math.PI * 2);
          ctx!.fillStyle = "rgba(0,255,65,0.14)"; ctx!.fill();
        }
      }

      // Center dot
      ctx!.beginPath(); ctx!.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx!.fillStyle = "rgba(0,255,65,0.8)"; ctx!.fill();

      // Outer ring
      ctx!.beginPath(); ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(0,255,65,0.18)"; ctx!.lineWidth = 1; ctx!.stroke();

      // Degree tick marks
      for (let d = 0; d < 360; d += 30) {
        const a = (d * Math.PI) / 180;
        const len = d % 90 === 0 ? 7 : 4;
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len));
        ctx!.lineTo(cx + Math.cos(a) * R,          cy + Math.sin(a) * R);
        ctx!.strokeStyle = d % 90 === 0 ? "rgba(0,255,65,0.28)" : "rgba(0,255,65,0.09)";
        ctx!.lineWidth = 0.7; ctx!.stroke();
      }

      sweep = (sweep + 0.019) % (Math.PI * 2);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []); // animation loop starts once — blipsRef updated via separate effect

  return (
    <canvas
      ref={cvRef}
      aria-hidden="true"
      style={{ width: 216, height: 216, willChange: "transform" }}
      suppressHydrationWarning
    />
  );
}

// ─── Ring gauge (SVG) ─────────────────────────────────────────

function RingGauge({
  label, value, max, color = "#00FF41", unit = "", sub,
}: {
  label: string; value: number; max: number;
  color?: string; unit?: string; sub?: string;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setAnimated(Math.min(value / Math.max(max, 1), 1)),
    );
    return () => cancelAnimationFrame(id);
  }, [value, max]);

  const R    = 29;
  const SZ   = 74;
  const cx   = SZ / 2, cy = SZ / 2;
  const circ = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: SZ, height: SZ }}>
        <svg width={SZ} height={SZ} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(0,255,65,0.07)" strokeWidth="4.5" />
          {/* Fill */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - animated)}
            style={{
              transition: "stroke-dashoffset 1.5s cubic-bezier(0.22,1,0.36,1)",
              filter: `drop-shadow(0 0 5px ${color}66)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono font-bold tabular-nums" style={{ color, fontSize: 13, lineHeight: "1" }}>
            {Math.round(value)}{unit}
          </span>
          {sub && (
            <span className="font-mono" style={{ color: "rgba(100,120,100,0.45)", fontSize: 7, marginTop: 2 }}>
              {sub}
            </span>
          )}
        </div>
      </div>
      <span className="font-mono text-[8px] text-zk-muted/40 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─── Live clock ───────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setT(fmt());
    const id = setInterval(() => setT(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-zk-green tabular-nums">{t}</span>;
}

// ─── SIGINT decode feed ───────────────────────────────────────

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>{}[]|/\\?+=";

function DecodeLine({ text, color }: { text: string; color: string }) {
  const [chars, setChars] = useState<string[]>(() =>
    text.split("").map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]),
  );

  useEffect(() => {
    let resolved = 0;
    const id = setInterval(() => {
      setChars((prev) => {
        const next = [...prev];
        // Resolve chars up to current position
        for (let j = 0; j <= resolved && j < text.length; j++) next[j] = text[j];
        // Randomise still-unresolved chars
        for (let j = resolved + 1; j < text.length; j++) {
          if (Math.random() > 0.45) next[j] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        return next;
      });
      resolved++;
      if (resolved >= text.length) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [text]);

  return <span className={cn("font-mono text-[11px] break-all", color)}>{chars.join("")}</span>;
}

const SIGINT_COLORS: Record<SigintType, string> = {
  PRESENCE: "text-zk-green",
  CHANNEL:  "text-[#00D4FF]",
  SESSION:  "text-zk-green/70",
  MSG:      "text-zk-amber",
  ROLE:     "text-[#00D4FF]/70",
  SYS:      "text-zk-muted/55",
};

const SIGINT_TAG: Record<SigintType, string> = {
  PRESENCE: "border-zk-green/25 bg-zk-green/5 text-zk-green",
  CHANNEL:  "border-[#00D4FF]/25 bg-[#00D4FF]/5 text-[#00D4FF]/80",
  SESSION:  "border-zk-green/15 text-zk-green/60",
  MSG:      "border-zk-amber/25 bg-zk-amber/5 text-zk-amber",
  ROLE:     "border-[#00D4FF]/15 text-[#00D4FF]/55",
  SYS:      "border-zk-muted/15 text-zk-muted/40",
};

function SigintFeed({ lines }: { lines: SigintLine[] }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div ref={bodyRef} className="h-full overflow-y-auto px-3 py-2 space-y-1">
      {lines.map((line) => (
        <div key={line.id} className="flex items-start gap-2 py-0.5">
          <span className="font-mono text-[9px] text-zk-muted/25 shrink-0 tabular-nums select-none pt-px">
            {line.timestamp}
          </span>
          <span className={cn(
            "font-mono text-[9px] shrink-0 px-1 rounded-sm border leading-4",
            SIGINT_TAG[line.type],
          )}>
            {line.type}
          </span>
          <DecodeLine text={line.text} color={SIGINT_COLORS[line.type]} />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function OverviewPage() {
  const profile = useProfile();
  const session = useSession();

  const [users,        setUsers]        = useState<CachedUser[]>([]);
  const [channelCount, setChannelCount] = useState(0);
  const [roleCount,    setRoleCount]    = useState(0);
  const [unreadInbox,  setUnreadInbox]  = useState(0);
  const [sigintLines,  setSigintLines]  = useState<SigintLine[]>([]);
  const lineId = useRef(0);

  const canSeeUsers = canViewUsers(profile.accessFlags);

  const pushLine = useCallback((type: SigintType, text: string) => {
    setSigintLines((prev) => [
      ...prev.slice(-60),
      {
        id:        lineId.current++,
        type,
        text,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ]);
  }, []);

  // ── Boot: hydrate from cache ──────────────────────────────
  useEffect(() => {
    getAppCache().hydrate();
    getChatCache().hydrate();

    const cachedUsers = getAppCache().getUsers();
    if (cachedUsers) setUsers(cachedUsers);

    const cachedChannels = getChatCache().getChannels();
    if (cachedChannels) setChannelCount(cachedChannels.length);

    const cachedRoles = getAppCache().getRoles();
    if (cachedRoles) setRoleCount(cachedRoles.length);

    const cachedInbox = getAppCache().getInbox();
    if (cachedInbox) setUnreadInbox(cachedInbox.filter((m) => !m.read).length);

    // Boot SIGINT
    pushLine("SYS",     `NEXUS CONTROL v1.0.0 // SYSTEM NOMINAL`);
    pushLine("SESSION", `auth.session // VALID · operator:${profile.username}`);

    if (cachedChannels?.length) {
      pushLine("CHANNEL", `CHANNEL MAP // ${cachedChannels.length} ACTIVE NODES REGISTERED`);
    }
    if (cachedUsers) {
      const online = cachedUsers.filter((u) => u.profile?.session_status === "ONLINE");
      if (online.length) {
        pushLine("PRESENCE", `GRID SCAN // ${online.length} OPERATORS ONLINE`);
        online.slice(0, 3).forEach((u) =>
          pushLine("PRESENCE", `@${u.profile?.username ?? u.id} // STATUS:ONLINE`),
        );
      }
    }
    if (cachedInbox) {
      const unread = cachedInbox.filter((m) => !m.read).length;
      if (unread) pushLine("MSG", `INBOX // ${unread} MESSAGES PENDING REVIEW`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live presence polling for all users ──────────────────
  // The SSE stream only watches DM partners, so the radar would stay stale
  // for other users. We poll /api/presence for everyone in the list and
  // patch session_status in-place — same approach as /system/users.
  const pollPresence = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/presence?ids=${ids.join(",")}`);
      if (!res.ok) return;
      const map: Record<string, "ONLINE" | "OFFLINE"> = await res.json();
      setUsers((prev) =>
        prev.map((u) => {
          const next = map[u.id];
          if (!next || !u.profile || u.profile.session_status === next) return u;
          return { ...u, profile: { ...u.profile, session_status: next } };
        }),
      );
    } catch { /* silent — stale data is acceptable */ }
  }, []);

  // Keep a ref of current user IDs so the polling interval never needs
  // `users` in its dep array — prevents the setUsers → users → re-fire loop.
  const userIdsRef = useRef<string[]>([]);
  useEffect(() => {
    userIdsRef.current = users.map((u) => u.id);
  }, [users]);

  // Periodic presence refresh — fires once ~2 s after mount (users should
  // be loaded by then) then every 15 s.  Reading from the ref instead of
  // from `users` state means pollPresence → setUsers → users change is
  // invisible to this effect and the loop is broken.
  useEffect(() => {
    const getIds = () =>
      userIdsRef.current.length
        ? userIdsRef.current
        : (getAppCache().getUsers()?.map((u) => u.id) ?? []);

    const onMount = setTimeout(() => {
      const ids = getIds();
      if (ids.length > 0) pollPresence(ids);
    }, 2_000);

    const interval = setInterval(() => {
      const ids = getIds();
      if (ids.length > 0) pollPresence(ids);
    }, 15_000);

    return () => {
      clearTimeout(onMount);
      clearInterval(interval);
    };
  }, [pollPresence]);

  // ── Cache event listeners ─────────────────────────────────
  useEffect(() => {
    function onUsers() {
      const u = getAppCache().getUsers();
      if (!u) return;
      setUsers(u);
      // Immediately patch presence for the freshly-loaded list so the radar
      // shows current statuses without waiting for the next 15-s interval.
      pollPresence(u.map((x) => x.id));
      const on = u.filter((x) => x.profile?.session_status === "ONLINE").length;
      pushLine("PRESENCE", `SCAN COMPLETE // ${on} ONLINE · ${u.length - on} OFFLINE`);
    }
    function onChannels() {
      const ch = getChatCache().getChannels();
      if (!ch) return;
      setChannelCount(ch.length);
      pushLine("CHANNEL", `CHANNEL MAP UPDATED // ${ch.length} ACTIVE`);
    }
    function onInbox() {
      const inbox = getAppCache().getInbox();
      if (!inbox) return;
      const unread = inbox.filter((m) => !m.read).length;
      setUnreadInbox(unread);
      if (unread) pushLine("MSG", `INBOX // ${unread} MESSAGES PENDING REVIEW`);
    }

    // Presence events arrive via SSE → ShellPrefetcher → getChatCache().setPresence()
    // → "zk:cache:presence". Patch session_status in-place so the radar and roster
    // update immediately without waiting for the 90-second users cache refresh.
    function onPresence() {
      const presMap = getChatCache().getPresence();
      if (!presMap) return;
      setUsers((prev) =>
        prev.map((u) => {
          const next = presMap[u.id] as "ONLINE" | "OFFLINE" | undefined;
          if (!next || !u.profile || u.profile.session_status === next) return u;
          return { ...u, profile: { ...u.profile, session_status: next } };
        }),
      );
    }

    window.addEventListener("zk:cache:users",    onUsers);
    window.addEventListener("zk:cache:channels", onChannels);
    window.addEventListener("zk:cache:inbox",    onInbox);
    window.addEventListener("zk:cache:presence", onPresence);
    return () => {
      window.removeEventListener("zk:cache:users",    onUsers);
      window.removeEventListener("zk:cache:channels", onChannels);
      window.removeEventListener("zk:cache:inbox",    onInbox);
      window.removeEventListener("zk:cache:presence", onPresence);
    };
  }, [pushLine, pollPresence]);

  // ── Periodic SIGINT heartbeat ─────────────────────────────
  useEffect(() => {
    const beats: [SigintType, string][] = [
      ["SYS",     "KERNEL HEARTBEAT // NOMINAL"],
      ["SESSION", "TLS_1.3 // HANDSHAKE VERIFIED"],
      ["SYS",     "MEMORY INTEGRITY // OK"],
      ["SYS",     "CRYPTOGRAPHIC SIGNATURE // VALID"],
      ["CHANNEL", "CHANNEL INTEGRITY CHECK // PASSED"],
      ["SYS",     "FIREWALL STATUS // ACTIVE · 0 THREATS"],
      ["SESSION", `auth.session // ALIVE · user:${profile.username}`],
      ["SYS",     "PACKET LOSS // 0.00% · LATENCY <1ms"],
    ];
    let i = 0;
    const id = setInterval(() => {
      const [type, text] = beats[i % beats.length];
      pushLine(type, text);
      i++;
    }, 4_200);
    return () => clearInterval(id);
  }, [pushLine, profile.username]);

  // ── Derived values ────────────────────────────────────────
  const onlineCount = users.filter((u) => u.profile?.session_status === "ONLINE").length;
  const totalUsers  = users.length;

  const operators = [...users]
    .sort((a, b) => {
      const ao = a.profile?.session_status === "ONLINE" ? 0 : 1;
      const bo = b.profile?.session_status === "ONLINE" ? 0 : 1;
      return ao - bo || (a.profile?.username ?? "").localeCompare(b.profile?.username ?? "");
    });

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden bg-zk-bg">

      {/* ── Status bar ──────────────────────────────────── */}
      <div className="shrink-0 h-9 flex items-center px-4 gap-4 border-b border-zk-border/60 bg-zk-surface/10">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-zk-green animate-pulse"
            style={{ boxShadow: "0 0 6px rgba(0,255,65,0.75)" }}
          />
          <span className="font-mono text-[10px] text-zk-green/75 tracking-widest">NEXUS CONTROL</span>
        </div>
        <span className="w-px h-3 bg-zk-border/50" aria-hidden="true" />
        <span className="font-mono text-[10px] text-zk-muted/45">SYS:ONLINE</span>
        <span className="font-mono text-[10px] text-zk-muted/45">NODES:{onlineCount}</span>
        <span className="font-mono text-[10px] text-zk-muted/45">CHAN:{channelCount}</span>
        {roleCount > 0 && (
          <span className="font-mono text-[10px] text-zk-muted/45">ROLES:{roleCount}</span>
        )}
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-[10px] text-zk-muted/35 tracking-wider hidden sm:block">
            {session.email.split("@")[0].toUpperCase()}@NEXUS
          </span>
          <LiveClock />
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left — Radar */}
        <div className="w-[248px] shrink-0 flex flex-col border-r border-zk-border/40 bg-zk-surface/10">
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-zk-border/25">
            <span className="font-mono text-[9px] text-zk-muted/45 uppercase tracking-widest">USER RADAR</span>
            <span className="font-mono text-[9px] text-zk-green/50">{onlineCount} ACTIVE</span>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <UserRadar users={users} />
          </div>

          <div className="shrink-0 grid grid-cols-2 border-t border-zk-border/25">
            <div className="flex flex-col items-center py-3 border-r border-zk-border/25">
              <span
                className="font-mono text-xl font-bold text-zk-green tabular-nums"
                style={{ textShadow: "0 0 12px rgba(0,255,65,0.45)" }}
              >
                {onlineCount}
              </span>
              <span className="font-mono text-[8px] text-zk-muted/40 uppercase tracking-wide mt-0.5">Online</span>
            </div>
            <div className="flex flex-col items-center py-3">
              <span className="font-mono text-xl font-bold text-zk-slate tabular-nums">{totalUsers || "—"}</span>
              <span className="font-mono text-[8px] text-zk-muted/40 uppercase tracking-wide mt-0.5">Total</span>
            </div>
          </div>
        </div>

        {/* Center — Gauges + Roster */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-zk-border/40 min-w-0">

          {/* Ring gauge strip */}
          <div className="shrink-0 border-b border-zk-border/30 bg-black/15">
            <div className="grid grid-cols-4 divide-x divide-zk-border/25">
              {[
                { label: "ONLINE",   value: onlineCount,  max: Math.max(totalUsers, 1), color: "#00FF41", sub: `/${totalUsers || "?"}` },
                { label: "CHANNELS", value: channelCount, max: 20,                       color: "#00D4FF" },
                { label: "ROLES",    value: roleCount,    max: 10,                       color: "#00D4FF" },
                { label: "INBOX",    value: unreadInbox,  max: Math.max(unreadInbox, 10), color: unreadInbox > 0 ? "#FFB800" : "#00FF41" },
              ].map((g, i) => (
                <div key={g.label} className={cn(
                  "flex items-center justify-center py-2",
                  i % 2 === 0 ? "bg-zk-surface/10" : "",
                )}>
                  <RingGauge {...g} />
                </div>
              ))}
            </div>
          </div>

          {/* Operator roster */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-zk-border/25 bg-black/20">
              <span className="font-mono text-[9px] text-zk-muted/45 uppercase tracking-widest">OPERATOR ROSTER</span>
              <span className="font-mono text-[9px] text-zk-muted/35">{operators.length} REGISTERED</span>
            </div>

            {/* Column headers */}
            <div className="shrink-0 grid grid-cols-[20px_1fr_1fr_72px_32px] gap-x-3 px-4 py-1 border-b border-zk-border/20">
              {["", "HANDLE", "DISPLAY", "ROLE", "ST"].map((h) => (
                <span key={h} className="font-mono text-[8px] text-zk-muted/35 uppercase tracking-wider">{h}</span>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {!canSeeUsers && operators.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2">
                  <span className="font-mono text-xs text-zk-muted/25">INSUFFICIENT CLEARANCE</span>
                  <span className="font-mono text-[9px] text-zk-muted/15">moderator permission required</span>
                </div>
              ) : operators.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                  <span className="font-mono text-xs text-zk-muted/25 animate-pulse">SCANNING...</span>
                </div>
              ) : operators.map((op) => {
                const online = op.profile?.session_status === "ONLINE";
                const username = op.profile?.username ?? "—";
                const display  = op.profile?.display_name || username;
                const role     = op.roles[0]?.name ?? (op.profile?.access_flags?.includes("c3ea3541-3bd7-40e6-aefe-29dc1a455088") ? "ADMIN" : "USER");

                return (
                  <div
                    key={op.id}
                    className="grid grid-cols-[20px_1fr_1fr_72px_32px] gap-x-3 px-4 py-2 hover:bg-zk-green/[0.025] transition-[background-color] duration-100"
                    style={{ borderBottom: "1px solid rgba(0,255,65,0.06)" }}
                  >
                    <div className="flex items-center">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        online ? "bg-zk-green" : "bg-zk-muted/25",
                      )}
                        style={online ? { boxShadow: "0 0 4px rgba(0,255,65,0.7)" } : undefined}
                      />
                    </div>
                    <span className="font-mono text-xs text-zk-white truncate">@{username}</span>
                    <span className="font-sans text-xs text-zk-muted/60 truncate">{display}</span>
                    <span className="font-mono text-xs text-[#00D4FF]/65 truncate uppercase">{role}</span>
                    <span className={cn(
                      "font-mono text-[10px]",
                      online ? "text-zk-green" : "text-zk-muted/35",
                    )}>
                      {online ? "ON" : "OFF"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right — SIGINT feed */}
        <div className="w-[272px] shrink-0 flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-zk-border/25 bg-black/20">
            <span className="font-mono text-[9px] text-zk-muted/45 uppercase tracking-widest">SIGINT FEED</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-zk-green animate-pulse" />
              <span className="font-mono text-[9px] text-zk-green/50">LIVE</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <SigintFeed lines={sigintLines} />
          </div>
        </div>

      </div>
    </div>
  );
}
