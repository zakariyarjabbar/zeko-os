// components/sections/CodeShowcase.tsx
// "Built by Engineers" — split layout with prose on the left
// and a fully styled mock terminal/code window on the right.

"use client";

import { useState } from "react";
import {
  Circle,
  Code2,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// ─── Code Tabs ───────────────────────────────────────────────
const CODE_TABS = ["bootstrap.ts", "deploy.sh", "schema.prisma"] as const;
type CodeTab = (typeof CODE_TABS)[number];

// ─── Code Content ────────────────────────────────────────────
// Realistic looking TypeScript / Bash / Prisma content per tab.
const CODE_CONTENT: Record<CodeTab, { lines: { text: string; type: string }[] }> = {
  "bootstrap.ts": {
    lines: [
      { text: "// zeko-os/core/bootstrap.ts",         type: "comment"  },
      { text: "// System initialization sequence",     type: "comment"  },
      { text: "",                                       type: "blank"   },
      { text: 'import { ZekoKernel } from "./kernel";',type: "keyword"  },
      { text: 'import { loadModules } from "./loader";',type: "keyword" },
      { text: 'import type { SystemConfig } from "./types";', type: "keyword" },
      { text: "",                                       type: "blank"   },
      { text: "const config: SystemConfig = {",        type: "plain"   },
      { text: "  version:     '1.0.0',",               type: "string"  },
      { text: "  environment:  process.env.NODE_ENV,", type: "plain"   },
      { text: "  modules:     ['auth', 'api', 'db'],", type: "string"  },
      { text: "  maxWorkers:   os.cpus().length,",     type: "plain"   },
      { text: "  telemetry:    true,",                 type: "plain"   },
      { text: "};",                                     type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "async function boot(): Promise<void> {",type: "fn"      },
      { text: "  const kernel = new ZekoKernel(config);", type: "plain" },
      { text: "",                                       type: "blank"   },
      { text: "  console.log('[ZEKO] Booting kernel...');", type: "log" },
      { text: "  await kernel.init();",                type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "  const mods = await loadModules(config.modules);", type: "plain" },
      { text: "  mods.forEach(m => kernel.register(m));", type: "plain" },
      { text: "",                                       type: "blank"   },
      { text: "  await kernel.start();",               type: "plain"   },
      { text: "  console.log('[ZEKO] System ONLINE ✓');", type: "success" },
      { text: "}",                                      type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "boot().catch(process.exit);",           type: "plain"   },
    ],
  },
  "deploy.sh": {
    lines: [
      { text: "#!/bin/bash",                           type: "comment"  },
      { text: "# zeko-os deployment script",           type: "comment"  },
      { text: "set -euo pipefail",                     type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: 'echo "[ZEKO] Starting deploy sequence..."', type: "log"  },
      { text: "",                                       type: "blank"   },
      { text: "# Run pre-deploy checks",               type: "comment"  },
      { text: "npm run lint && npm run typecheck",      type: "plain"   },
      { text: "npm run test -- --coverage",            type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "# Build production bundle",             type: "comment"  },
      { text: "NODE_ENV=production npm run build",     type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "# Tag and push Docker image",           type: "comment"  },
      { text: 'IMAGE="gcr.io/zeko-os/app:$GIT_SHA"',  type: "string"  },
      { text: "docker build -t $IMAGE .",              type: "plain"   },
      { text: "docker push $IMAGE",                    type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "# Apply Kubernetes manifests",          type: "comment"  },
      { text: "kubectl apply -f ./k8s/",               type: "plain"   },
      { text: "kubectl rollout status deployment/zeko-app", type: "plain" },
      { text: "",                                       type: "blank"   },
      { text: 'echo "[ZEKO] Deploy complete ✓"',       type: "success" },
    ],
  },
  "schema.prisma": {
    lines: [
      { text: "// zeko-os/prisma/schema.prisma",       type: "comment"  },
      { text: "",                                       type: "blank"   },
      { text: "generator client {",                    type: "fn"      },
      { text: '  provider = "prisma-client-js"',       type: "string"  },
      { text: "}",                                      type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "datasource db {",                       type: "fn"      },
      { text: '  provider = "postgresql"',             type: "string"  },
      { text: '  url      = env("DATABASE_URL")',      type: "string"  },
      { text: "}",                                      type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "model User {",                          type: "fn"      },
      { text: "  id        String   @id @default(cuid())", type: "plain" },
      { text: "  email     String   @unique",          type: "plain"   },
      { text: "  username  String   @unique",          type: "plain"   },
      { text: "  role      Role     @default(USER)",   type: "plain"   },
      { text: "  modules   Module[]",                  type: "plain"   },
      { text: "  createdAt DateTime @default(now())",  type: "plain"   },
      { text: "  updatedAt DateTime @updatedAt",       type: "plain"   },
      { text: "}",                                      type: "plain"   },
      { text: "",                                       type: "blank"   },
      { text: "enum Role {",                           type: "fn"      },
      { text: "  USER",                                type: "plain"   },
      { text: "  ADMIN",                               type: "plain"   },
      { text: "  SYSTEM",                              type: "plain"   },
      { text: "}",                                      type: "plain"   },
    ],
  },
};

// ─── Syntax Color Map ────────────────────────────────────────
const LINE_COLOR: Record<string, string> = {
  comment: "text-zk-muted/70 italic",
  keyword: "text-zk-cyan",
  string:  "text-zk-amber",
  fn:      "text-zk-green",
  plain:   "text-zk-white/80",
  log:     "text-zk-slate",
  success: "text-zk-green font-semibold",
  blank:   "",
};

// ─── Value Propositions ──────────────────────────────────────
const PROPOSITIONS = [
  "Written in 100% TypeScript — no runtime surprises.",
  "Fully automated CI/CD from commit to production.",
  "Infrastructure-as-code: your infra lives in Git.",
  "Zero-downtime deployments with instant rollback.",
];

// ─── Component ──────────────────────────────────────────────
export function CodeShowcase() {
  const [activeTab, setActiveTab] = useState<CodeTab>("bootstrap.ts");

  const lines = CODE_CONTENT[activeTab].lines;

  return (
    <section id="showcase" className="relative py-16 px-6">

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left: Text Content ──────────────────────── */}
          <div>
            <p className="section-label mb-3">{"// BUILT_BY_ENGINEERS"}</p>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-zk-white leading-tight mb-6">
              Code that ships.{" "}
              <span className="font-mono text-zk-green text-glow-sm block mt-1">
                Systems that scale.
              </span>
            </h2>
            <p className="text-zk-slate text-lg leading-relaxed mb-8">
              Every line is written with production in mind. No scaffolding, no
              shortcuts — just clean, testable, deployable code built on
              proven patterns.
            </p>

            {/* Value proposition list */}
            <ul className="space-y-3 mb-10">
              {PROPOSITIONS.map((prop) => (
                <li key={prop} className="flex items-start gap-3">
                  <CheckCircle2
                    size={16}
                    className="text-zk-green mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-zk-slate text-sm leading-relaxed">
                    {prop}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="md"
                rightIcon={<ChevronRight size={14} />}
              >
                View on GitHub
              </Button>
              <Button variant="ghost" size="md" leftIcon={<Code2 size={14} />}>
                Read the Docs
              </Button>
            </div>
          </div>

          {/* ── Right: Terminal Window ───────────────────── */}
          <div className="terminal-block shadow-[0_0_60px_rgba(0,255,65,0.08),_0_0_120px_rgba(0,255,65,0.04)]">

            {/* Window chrome / title bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zk-green/15 bg-[rgba(0,0,0,0.4)]">
              {/* Traffic lights */}
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <Circle size={10} className="fill-zk-red/70 text-zk-red/70" />
                <Circle size={10} className="fill-zk-amber/70 text-zk-amber/70" />
                <Circle size={10} className="fill-zk-green/70 text-zk-green/70" />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1">
                {CODE_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "font-mono text-[11px] px-3 py-1 rounded-sm transition-all duration-150",
                      tab === activeTab
                        ? "text-zk-green bg-zk-green/10 border border-zk-green/25"
                        : "text-zk-muted hover:text-zk-slate border border-transparent"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Terminal indicator */}
              <span className="font-mono text-[10px] text-zk-muted">
                zeko@os:~$
              </span>
            </div>

            {/* Code content */}
            <div className="overflow-auto h-[460px] p-5 scrollbar-thin">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="group hover:bg-zk-green/[0.03]">
                      {/* Line number */}
                      <td className="pr-5 select-none text-right font-mono text-[11px] text-zk-muted/40 group-hover:text-zk-muted/70 w-8 align-top pt-0.5">
                        {line.type !== "blank" ? i + 1 : ""}
                      </td>
                      {/* Code text */}
                      <td
                        className={cn(
                          "font-mono text-[12px] leading-[1.8] whitespace-pre",
                          LINE_COLOR[line.type] ?? "text-zk-white/80"
                        )}
                      >
                        {line.text}
                      </td>
                    </tr>
                  ))}

                  {/* Prompt line */}
                  <tr>
                    <td className="pr-5 select-none text-right font-mono text-[11px] text-zk-muted/40 w-8">
                      {lines.length + 1}
                    </td>
                    <td className="font-mono text-[12px] leading-[1.8] text-zk-green">
                      <span>{">"}&nbsp;</span>
                      <span className="terminal-cursor" aria-hidden="true" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-zk-green/10 bg-[rgba(0,0,0,0.3)]">
              <span className="font-mono text-[10px] text-zk-green/60">
                ● TypeScript &nbsp;|&nbsp; UTF-8 &nbsp;|&nbsp; LF
              </span>
              <span className="font-mono text-[10px] text-zk-muted/60">
                Ln {lines.length}, Col 1
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
