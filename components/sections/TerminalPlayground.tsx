// components/sections/TerminalPlayground.tsx
// Interactive terminal section — users can type real commands and see
// streaming output. Supports arrow-key history, tab-complete, and a
// matrix-rain easter egg.

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────
type LineColor = "green" | "muted" | "white" | "amber" | "red" | "cyan";
type LineKind  = "prompt" | "output" | "blank";

interface TermLine {
  id:    number;
  kind:  LineKind;
  text:  string;
  color: LineColor;
}

type CmdOutput = Omit<TermLine, "id">[];

// ─── Color → Tailwind class ──────────────────────────────────
const COLOR: Record<LineColor, string> = {
  green: "text-zk-green",
  muted: "text-zk-muted",
  white: "text-zk-white",
  amber: "text-zk-amber",
  red:   "text-zk-red",
  cyan:  "text-zk-cyan",
};

// ─── Welcome lines ───────────────────────────────────────────
const WELCOME: CmdOutput = [
  { kind: "output", text: "Zeko OS v1.0.0  ·  Interactive Shell", color: "green" },
  { kind: "output", text: "Type 'help' for a list of commands. Tab to autocomplete.", color: "muted" },
  { kind: "blank",  text: "", color: "muted" },
];

// ─── Command registry ────────────────────────────────────────
const REGISTRY: Record<string, (args: string[]) => CmdOutput> = {
  help: () => [
    { kind: "output", text: "Available commands:", color: "green" },
    { kind: "blank",  text: "", color: "muted" },
    { kind: "output", text: "  help          — display this message",         color: "muted" },
    { kind: "output", text: "  whoami        — operator identification",      color: "muted" },
    { kind: "output", text: "  status        — live system health check",     color: "muted" },
    { kind: "output", text: "  ls            — list active modules",          color: "muted" },
    { kind: "output", text: "  skills        — tech stack overview",          color: "muted" },
    { kind: "output", text: "  ping [host]   — test connection latency",      color: "muted" },
    { kind: "output", text: "  neofetch      — system information",           color: "muted" },
    { kind: "output", text: "  date          — current timestamp",            color: "muted" },
    { kind: "output", text: "  uname [-a]    — kernel information",           color: "muted" },
    { kind: "output", text: "  contact       — navigate to contact section",  color: "muted" },
    { kind: "output", text: "  matrix        — ???",                          color: "muted" },
    { kind: "output", text: "  clear         — clear terminal output",        color: "muted" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  whoami: () => [
    { kind: "output", text: "┌─ OPERATOR IDENTIFICATION ────────────────────┐", color: "green" },
    { kind: "output", text: "│                                               │", color: "green" },
    { kind: "output", text: "│  NAME      zakariya r. jabbar                 │", color: "white" },
    { kind: "output", text: "│  ALIAS     zeko                               │", color: "white" },
    { kind: "output", text: "│  ROLE      Full-Stack Engineer                │", color: "white" },
    { kind: "output", text: "│  CLEARANCE root                               │", color: "green" },
    { kind: "output", text: "│  STATUS    ● active                           │", color: "green" },
    { kind: "output", text: "│  LOCATION  [REDACTED]                         │", color: "muted" },
    { kind: "output", text: "│                                               │", color: "green" },
    { kind: "output", text: "└───────────────────────────────────────────────┘", color: "green" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  status: () => [
    { kind: "output", text: "── SYSTEM STATUS ──────────────────────────────", color: "green" },
    { kind: "blank",  text: "", color: "muted" },
    { kind: "output", text: "  KERNEL   [████████████████]  100%   OK",       color: "white" },
    { kind: "output", text: "  MEMORY   [███████████░░░░░]   67%   nominal",  color: "white" },
    { kind: "output", text: "  CPU      [██████░░░░░░░░░░]   34%   nominal",  color: "white" },
    { kind: "output", text: "  NETWORK  [████████████████]  100%   ONLINE",   color: "white" },
    { kind: "blank",  text: "", color: "muted" },
    { kind: "output", text: "  UPTIME   99.97%   ·   RECORD: 847d 14h 22m", color: "green" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  ls: () => [
    { kind: "output", text: "total 6 modules", color: "muted" },
    { kind: "blank",  text: "", color: "muted" },
    { kind: "output", text: "  drwxr-xr-x   auth/       Authentication System",  color: "white" },
    { kind: "output", text: "  drwxr-xr-x   api/        REST API Gateway",       color: "white" },
    { kind: "output", text: "  drwxr-xr-x   chat/       Real-time Chat Module",  color: "white" },
    { kind: "output", text: "  drwxr-xr-x   roles/      RBAC Role Manager",      color: "white" },
    { kind: "output", text: "  drwxr-xr-x   users/      User Management Panel",  color: "white" },
    { kind: "output", text: "  -rwxr-xr-x   contact.sh  Contact Interface",      color: "green" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  skills: () => [
    { kind: "output", text: "── TECH STACK ─────────────────────────────────", color: "green" },
    { kind: "blank",  text: "", color: "muted" },
    { kind: "output", text: "  LANGUAGES    TypeScript · Python · Go · SQL",  color: "white" },
    { kind: "output", text: "  FRONTEND     Next.js · React · Tailwind CSS",  color: "white" },
    { kind: "output", text: "  BACKEND      Node.js · PostgreSQL · Redis",    color: "white" },
    { kind: "output", text: "  TOOLING      Docker · Git · Linux · Nginx",    color: "white" },
    { kind: "output", text: "  AI / ML      OpenAI API · LangChain · RAG",    color: "white" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  ping: (args) => {
    const host = args[0] ?? "zeko.os";
    return [
      { kind: "output", text: `PING ${host} (127.0.0.1): 56 data bytes`,                color: "muted"  },
      { kind: "output", text: `64 bytes from ${host}: icmp_seq=0 ttl=64 time=0.8 ms`,  color: "white"  },
      { kind: "output", text: `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.6 ms`,  color: "white"  },
      { kind: "output", text: `64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.7 ms`,  color: "white"  },
      { kind: "blank",  text: "", color: "muted" },
      { kind: "output", text: `--- ${host} ping statistics ---`,                        color: "muted"  },
      { kind: "output", text: "3 packets transmitted, 3 received, 0% packet loss",      color: "green"  },
      { kind: "blank",  text: "", color: "muted" },
    ];
  },

  neofetch: () => [
    { kind: "output", text: "        ████████████████          zeko@zeko-os",           color: "green" },
    { kind: "output", text: "      ████████████████████        ─────────────────────",  color: "green" },
    { kind: "output", text: "     ██████████████████████       OS:       Zeko OS v1.0.0", color: "white" },
    { kind: "output", text: "    ████████████████████████      Kernel:   6.1.0-zk",     color: "white" },
    { kind: "output", text: "    ████  ████████████  ████      Uptime:   99.97%",       color: "white" },
    { kind: "output", text: "    ████  ████████████  ████      Packages: 142 (npm)",    color: "white" },
    { kind: "output", text: "    ████████████████████████      Shell:    zk-bash 1.0",  color: "white" },
    { kind: "output", text: "     ██████████████████████       Theme:    Matrix Dark",  color: "white" },
    { kind: "output", text: "      ████████████████████        Memory:   32 GB",        color: "white" },
    { kind: "output", text: "        ████████████████          Resolution: ∞ × ∞",      color: "white" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  date: () => [
    { kind: "output", text: new Date().toString(), color: "white" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  uname: (args) => {
    if (args[0] === "-a" || args[0] === "--all") {
      return [
        { kind: "output", text: "Zeko OS 6.1.0-zk #1 SMP PREEMPT x86_64 GNU/Linux", color: "white" },
        { kind: "blank",  text: "", color: "muted" },
      ];
    }
    return [
      { kind: "output", text: "Zeko OS", color: "white" },
      { kind: "blank",  text: "", color: "muted" },
    ];
  },

  sudo: () => [
    { kind: "output", text: "sudo: permission denied — nice try.", color: "red" },
    { kind: "output", text: "This incident has been logged.", color: "muted" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  exit: () => [
    { kind: "output", text: "exit: you cannot leave the matrix.", color: "amber" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  vim: () => [
    { kind: "output", text: "VIM 9.0 — enter ':q!' to exit... just kidding, you can't.", color: "muted" },
    { kind: "blank",  text: "", color: "muted" },
  ],

  nano: () => [
    { kind: "output", text: "  [ nano 7.2 ]  ^X Exit  ^O Write Out  ^G Help", color: "muted" },
    { kind: "output", text: "  (This terminal does not support nano.)", color: "muted" },
    { kind: "blank",  text: "", color: "muted" },
  ],
};

const ALL_COMMANDS = [
  ...Object.keys(REGISTRY), "clear", "matrix", "contact",
].sort();

// ─── Matrix Rain Canvas ──────────────────────────────────────
function MatrixRain({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const CHARS    = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()[]{}<>?!~|;:/\\";
    const FONT_SZ  = 13;
    const cols     = Math.floor(canvas.width / FONT_SZ);
    const drops    = Array.from({ length: cols }, () => Math.random() * -60);

    // Capture non-null refs for use inside the animation closure
    const c   = ctx;
    const cvs = canvas;

    let animId: number;

    function draw() {
      c.fillStyle = "rgba(6,13,6,0.08)";
      c.fillRect(0, 0, cvs.width, cvs.height);

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * FONT_SZ;
        if (y < 0) { drops[i] += 0.5; continue; }

        // Bright head
        c.fillStyle = "#CCFFCC";
        c.font = `bold ${FONT_SZ}px JetBrains Mono, monospace`;
        c.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FONT_SZ, y);

        // Green body
        c.fillStyle = "#00FF41";
        c.font = `${FONT_SZ}px JetBrains Mono, monospace`;
        c.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * FONT_SZ, y - FONT_SZ);

        if (y > cvs.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    const timer = setTimeout(() => {
      cancelAnimationFrame(animId);
      onDone();
    }, 3500);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timer);
    };
  }, [onDone]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ─── Quick command chip ───────────────────────────────────────
function Chip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "font-mono text-[11px] px-2.5 py-1 rounded-sm",
        "border border-zk-border text-zk-muted",
        "hover:border-zk-green/40 hover:text-zk-green hover:bg-zk-green/5",
        "transition-all duration-150 active:scale-95"
      )}
    >
      {label}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────
export function TerminalPlayground() {
  const makeId  = useRef(WELCOME.length);
  const getId   = () => makeId.current++;

  const [lines, setLines] = useState<TermLine[]>(() =>
    WELCOME.map((l, i) => ({ ...l, id: i }))
  );
  const [input,       setInput]       = useState("");
  const [isFocused,   setIsFocused]   = useState(false);
  const [matrixPhase, setMatrixPhase] = useState<"off" | "on" | "fadeout">("off");

  const inputRef    = useRef<HTMLInputElement>(null);
  const outputRef   = useRef<HTMLDivElement>(null);
  const queueRef    = useRef<CmdOutput>([]);
  const historyRef  = useRef<string[]>([]);
  const histIdxRef  = useRef(-1);

  // Drain output queue — one line every 35 ms for a streaming feel
  useEffect(() => {
    const iv = setInterval(() => {
      if (queueRef.current.length === 0) return;
      const next = queueRef.current.shift()!;
      setLines(prev => [...prev, { ...next, id: getId() }]);
    }, 35);
    return () => clearInterval(iv);
   
  }, []);

  // Auto-scroll to bottom whenever lines change
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const enqueue = (output: CmdOutput) => {
    queueRef.current.push(...output);
  };

  const handleMatrixDone = useCallback(() => {
    setMatrixPhase("fadeout");
    setTimeout(() => setMatrixPhase("off"), 600);
  }, []);

  const runCommand = useCallback((raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;

    // Echo the command
    setLines(prev => [
      ...prev,
      { id: getId(), kind: "prompt", text: cmd, color: "green" },
    ]);

    historyRef.current = [cmd, ...historyRef.current].slice(0, 50);
    histIdxRef.current = -1;
    setInput("");

    const [name, ...args] = cmd.toLowerCase().split(/\s+/);

    if (name === "clear") {
      // Flush queue first
      queueRef.current = [];
      setLines([]);
      return;
    }

    if (name === "matrix") {
      enqueue([
        { kind: "output", text: "Initiating matrix protocol...", color: "green" },
        { kind: "blank",  text: "", color: "muted" },
      ]);
      setTimeout(() => setMatrixPhase("on"), 300);
      return;
    }

    if (name === "contact") {
      enqueue([
        { kind: "output", text: "Opening communication channel...", color: "green" },
        { kind: "output", text: "Routing to /#contact...", color: "muted" },
        { kind: "blank",  text: "", color: "muted" },
      ]);
      setTimeout(() => {
        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
      }, 700);
      return;
    }

    const handler = REGISTRY[name];
    if (handler) {
      enqueue(handler(args));
    } else {
      enqueue([
        {
          kind:  "output",
          text:  `zk: command not found: ${name}. Type 'help' for available commands.`,
          color: "red",
        },
        { kind: "blank", text: "", color: "muted" },
      ]);
    }
   
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        runCommand(input);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = histIdxRef.current + 1;
        if (idx < historyRef.current.length) {
          histIdxRef.current = idx;
          setInput(historyRef.current[idx]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = histIdxRef.current - 1;
        if (idx < 0) {
          histIdxRef.current = -1;
          setInput("");
        } else {
          histIdxRef.current = idx;
          setInput(historyRef.current[idx]);
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (!input.trim()) return;
        const match = ALL_COMMANDS.find(c => c.startsWith(input.toLowerCase()));
        if (match) setInput(match);
      }
    },
    [input, runCommand]
  );

  const focusInput = () => inputRef.current?.focus();

  return (
    <section id="terminal-playground" className="relative py-20 px-6">
      <div className="max-w-4xl mx-auto">

        {/* ── Section header ──────────────────────────────── */}
        <div className="mb-12 text-center">
          <p className="section-label mb-3">{"// SYSTEM_INTERFACE"}</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-zk-white leading-tight mb-4">
            Try the{" "}
            <span className="font-mono text-zk-green text-glow-sm">Shell</span>
          </h2>
          <p className="text-zk-slate text-lg max-w-xl mx-auto leading-relaxed">
            An interactive terminal running inside the OS. Type{" "}
            <code className="font-mono text-zk-green text-sm bg-zk-green/8 px-1.5 py-0.5 rounded-sm">
              help
            </code>{" "}
            to begin, or click a command below.
          </p>
        </div>

        {/* ── Terminal window ──────────────────────────────── */}
        <div
          className="terminal-block relative shadow-[0_0_80px_rgba(0,255,65,0.07)] cursor-text"
          onClick={focusInput}
        >
          {/* Matrix rain overlay */}
          {matrixPhase !== "off" && (
            <div
              className="absolute inset-0 z-20 rounded-xl overflow-hidden transition-opacity duration-600"
              style={{ opacity: matrixPhase === "fadeout" ? 0 : 1 }}
            >
              <MatrixRain onDone={handleMatrixDone} />
            </div>
          )}

          {/* Title bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zk-green/15 bg-black/40">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-zk-green" />
              <span className="font-mono text-xs text-zk-green/80 tracking-wider">
                zeko@os — /bin/zk-bash
              </span>
            </div>
            {/* Traffic-light dots */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-zk-red/50"   aria-hidden="true" />
              <span className="w-3 h-3 rounded-full bg-zk-amber/50" aria-hidden="true" />
              <span className="w-3 h-3 rounded-full bg-zk-green/50" aria-hidden="true" />
            </div>
          </div>

          {/* Output area */}
          <div
            ref={outputRef}
            className="h-80 overflow-y-auto px-5 py-4 space-y-0.5 scrollbar-terminal"
          >
            {lines.map((line) => (
              <div
                key={line.id}
                className="font-mono text-xs leading-5"
                style={{ animation: "zk-log-appear 0.2s ease-out both" }}
              >
                {line.kind === "prompt" ? (
                  <div className="flex items-start gap-2">
                    <span className="text-zk-green/50 shrink-0 select-none">
                      zeko@os:~$
                    </span>
                    <span className="text-zk-green break-all">{line.text}</span>
                  </div>
                ) : line.kind === "blank" ? (
                  <div className="h-2" aria-hidden="true" />
                ) : (
                  <span className={cn("whitespace-pre", COLOR[line.color])}>
                    {line.text}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Input row */}
          <div
            className={cn(
              "flex items-center gap-3 px-5 py-3 border-t border-zk-green/15 bg-black/30",
              "transition-all duration-200",
              isFocused && "bg-zk-green/[0.03] border-zk-green/25"
            )}
          >
            <span className="font-mono text-xs text-zk-green/50 shrink-0 select-none">
              zeko@os:~$
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="flex-1 bg-transparent outline-none font-mono text-sm text-zk-green caret-zk-green placeholder:text-zk-muted/30"
              placeholder="type a command..."
              autoComplete="off"
              spellCheck={false}
              aria-label="Terminal input"
            />
            {/* Blinking cursor shown when unfocused */}
            {!isFocused && (
              <span className="terminal-cursor" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* ── Quick-command chips ──────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {["help", "whoami", "status", "ls", "skills", "neofetch", "ping zeko.os", "matrix"].map(
            (cmd) => (
              <Chip
                key={cmd}
                label={cmd}
                onClick={() => {
                  runCommand(cmd);
                  focusInput();
                }}
              />
            )
          )}
        </div>

        {/* ── Keyboard hints ───────────────────────────────── */}
        <p className="mt-4 text-center font-mono text-[10px] text-zk-muted/40 tracking-widest">
          ↑ ↓ history &nbsp;·&nbsp; Tab autocomplete &nbsp;·&nbsp; Enter execute
        </p>

      </div>
    </section>
  );
}
