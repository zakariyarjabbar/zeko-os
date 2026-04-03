// components/system/chat/mock-data.ts
// Hardcoded channels, DMs, and message history for the chat UI.

// ─── Channels ─────────────────────────────────────────────────
export interface Channel {
  id: string;
  label: string;
  unread: number;
  memberCount: number;
  topic: string;
}

export const CHANNELS: Channel[] = [
  { id: "global-ops",      label: "#global-ops",      unread: 0, memberCount: 4, topic: "encrypted channel · 4 online" },
  { id: "system-logs",     label: "#system-logs",     unread: 3, memberCount: 2, topic: "system event stream · 2 online" },
  { id: "deployment",      label: "#deployment",      unread: 1, memberCount: 3, topic: "deployment pipeline · 3 online" },
  { id: "security-alerts", label: "#security-alerts", unread: 0, memberCount: 2, topic: "threat monitoring · 2 online" },
];

// ─── Direct Messages ──────────────────────────────────────────
export interface DMUser {
  id: string;
  handle: string;
  status: "online" | "away" | "offline";
  unread: number;
}

export const DM_USERS: DMUser[] = [
  { id: "dm-vader",  handle: "z.jabbar",    status: "online",  unread: 0 },
  { id: "dm-nova",   handle: "n.cross",     status: "online",  unread: 2 },
  { id: "dm-cipher", handle: "c.wraight",   status: "away",    unread: 0 },
];

// ─── Messages ─────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  channel: string;       // channel id or dm id
  timestamp: string;     // HH:MM:SS
  user: string;
  text: string;
  type: "message" | "system";
}

export const MOCK_MESSAGES: ChatMessage[] = [
  // ── #global-ops ─────────────────────────────────────────────
  { id: "m01", channel: "global-ops", timestamp: "08:14:02", user: "SYSTEM",    type: "system",  text: "Channel #global-ops initialized. E2E encryption active." },
  { id: "m02", channel: "global-ops", timestamp: "08:14:11", user: "z.jabbar",  type: "message", text: "All units online. Beginning morning sync." },
  { id: "m03", channel: "global-ops", timestamp: "08:14:45", user: "n.cross",   type: "message", text: "Confirmed. Auth module is running clean — no anomalies in the last 6h window." },
  { id: "m04", channel: "global-ops", timestamp: "08:15:03", user: "c.wraight", type: "message", text: "I pushed the hardened nginx config to staging. Review when you get a second." },
  { id: "m05", channel: "global-ops", timestamp: "08:15:29", user: "z.jabbar",  type: "message", text: "On it. Also — memory leak in the telemetry daemon was traced back to the buffer flush interval. Patched in commit a3f91c." },
  { id: "m06", channel: "global-ops", timestamp: "08:16:07", user: "n.cross",   type: "message", text: "Nice catch. That daemon was bleeding ~12MB/hr. Should have caught it in the profiler pass." },
  { id: "m07", channel: "global-ops", timestamp: "08:16:44", user: "c.wraight", type: "message", text: "Staging deploy ETA: 09:00. I'll monitor the rollout and post deltas here." },
  { id: "m08", channel: "global-ops", timestamp: "08:17:02", user: "z.jabbar",  type: "message", text: "Copy. Keep the rollback manifest ready — last deploy had a config drift issue on node-3." },
  { id: "m09", channel: "global-ops", timestamp: "08:17:38", user: "SYSTEM",    type: "system",  text: "r.ghost has joined the channel." },
  { id: "m10", channel: "global-ops", timestamp: "08:17:41", user: "r.ghost",   type: "message", text: "Catching up on logs. What's the status on the key rotation schedule?" },
  { id: "m11", channel: "global-ops", timestamp: "08:18:05", user: "n.cross",   type: "message", text: "Rotation is set for 02:00 UTC tonight. I've already updated the vault references — zero downtime expected." },
  { id: "m12", channel: "global-ops", timestamp: "08:18:33", user: "z.jabbar",  type: "message", text: "Good. Make sure the secondary nodes pull the new certs before the primary rotates. Sequencing matters here." },
  { id: "m13", channel: "global-ops", timestamp: "08:19:01", user: "r.ghost",   type: "message", text: "Already scripted. Tested against the dev cluster last night — clean handoff at every node." },
  { id: "m14", channel: "global-ops", timestamp: "08:19:22", user: "c.wraight", type: "message", text: "One more thing — the rate limiter on /api/auth/login is set to 10 req/min. Should we tighten that?" },
  { id: "m15", channel: "global-ops", timestamp: "08:19:55", user: "z.jabbar",  type: "message", text: "Drop it to 5 req/min and add exponential backoff after 3 failures. That's the standard posture." },
  { id: "m16", channel: "global-ops", timestamp: "08:20:11", user: "n.cross",   type: "message", text: "Agreed. I'll open a PR. Also flagging: anomalous traffic spike on /api/* at 07:42 — looks like a scanner. Blocked at edge." },
  { id: "m17", channel: "global-ops", timestamp: "08:20:44", user: "r.ghost",   type: "message", text: "I saw that. 4,200 requests in 90 seconds from a single AS block. Already filed an incident report." },
  { id: "m18", channel: "global-ops", timestamp: "08:21:03", user: "z.jabbar",  type: "message", text: "Good. Add the AS range to the permanent block list and update the threat model doc." },
  { id: "m19", channel: "global-ops", timestamp: "08:21:30", user: "SYSTEM",    type: "system",  text: "Automated checkpoint: all systems nominal. Next check in 60 minutes." },
  { id: "m20", channel: "global-ops", timestamp: "08:21:45", user: "c.wraight", type: "message", text: "All clear on my end. Heading into the staging deploy. Will report back at 09:15." },

  // ── #system-logs ────────────────────────────────────────────
  { id: "s01", channel: "system-logs", timestamp: "08:00:00", user: "DAEMON",   type: "system",  text: "System monitor started. PID 1842. Polling interval: 30s." },
  { id: "s02", channel: "system-logs", timestamp: "08:00:30", user: "DAEMON",   type: "system",  text: "CPU: 12% · MEM: 3.1GB/16GB · DISK: 44% · NET: 2.1MB/s" },
  { id: "s03", channel: "system-logs", timestamp: "08:07:12", user: "DAEMON",   type: "system",  text: "Auth service restarted cleanly. Uptime reset. Sessions preserved via cookie store." },
  { id: "s04", channel: "system-logs", timestamp: "08:14:02", user: "DAEMON",   type: "system",  text: "New session: user=z.jabbar ip=10.0.0.4 ua=ZekoClient/1.0" },

  // ── #deployment ─────────────────────────────────────────────
  { id: "d01", channel: "deployment", timestamp: "07:55:00", user: "SYSTEM",    type: "system",  text: "Pipeline #deploy-088 triggered by push to branch: main" },
  { id: "d02", channel: "deployment", timestamp: "07:55:12", user: "ci-runner", type: "message", text: "Stage 1/4: Dependency install — PASS (12.3s)" },
  { id: "d03", channel: "deployment", timestamp: "07:55:30", user: "ci-runner", type: "message", text: "Stage 2/4: Unit tests — PASS (28.7s) · 214 tests, 0 failures" },
  { id: "d04", channel: "deployment", timestamp: "07:56:01", user: "ci-runner", type: "message", text: "Stage 3/4: Build — PASS (41.2s) · Bundle: 384KB gzip" },
  { id: "d05", channel: "deployment", timestamp: "07:56:50", user: "ci-runner", type: "message", text: "Stage 4/4: Deploy to staging — PASS (48.9s) · 3 nodes updated" },
  { id: "d06", channel: "deployment", timestamp: "07:56:51", user: "SYSTEM",    type: "system",  text: "Pipeline #deploy-088 completed successfully. Duration: 2m 11s." },
];
