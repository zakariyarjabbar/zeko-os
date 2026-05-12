// components/sections/Features.tsx
// "System Modules" — a grid of glassmorphism feature cards,
// each with an icon, title, description, and tag badges.

import {
  Layers,
  Shield,
  Zap,
  GitBranch,
  Database,
  Globe,
  Terminal,
  Cpu,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

// ─── Feature Data ────────────────────────────────────────────
const FEATURES = [
  {
    id: "arch",
    icon: Layers,
    title: "Full-Stack Architecture",
    description:
      "End-to-end system design from database schema to frontend rendering. Every layer optimized for throughput and maintainability.",
    badges: [
      { label: "Next.js", variant: "green" },
      { label: "Postgres", variant: "muted" },
      { label: "Redis", variant: "amber" },
    ],
    featured: true,
  },
  {
    id: "security",
    icon: Shield,
    title: "System Security",
    description:
      "Zero-trust security model. Auth layers, rate limiting, input sanitization, and encrypted channels across all endpoints.",
    badges: [
      { label: "OAuth 2.0", variant: "green" },
      { label: "mTLS", variant: "muted" },
      { label: "OWASP", variant: "red" },
    ],
    featured: false,
  },
  {
    id: "perf",
    icon: Zap,
    title: "Performance Engine",
    description:
      "Sub-20ms response times via edge computing, aggressive caching strategies, and runtime-level code splitting.",
    badges: [
      { label: "Edge CDN", variant: "green" },
      { label: "ISR", variant: "cyan" },
      { label: "<20ms", variant: "green" },
    ],
    featured: false,
  },
  {
    id: "devops",
    icon: GitBranch,
    title: "CI/CD Pipelines",
    description:
      "Automated test → build → deploy workflows. Blue-green deployments with instant rollback and zero downtime releases.",
    badges: [
      { label: "GitHub Actions", variant: "muted" },
      { label: "Docker", variant: "cyan" },
      { label: "K8s", variant: "green" },
    ],
    featured: false,
  },
  {
    id: "data",
    icon: Database,
    title: "Data Systems",
    description:
      "Schema design, migrations, query optimization, and real-time streaming pipelines from ingestion to aggregation.",
    badges: [
      { label: "PostgreSQL", variant: "green" },
      { label: "Prisma", variant: "muted" },
      { label: "Kafka", variant: "amber" },
    ],
    featured: false,
  },
  {
    id: "api",
    icon: Globe,
    title: "API Infrastructure",
    description:
      "Type-safe REST and GraphQL APIs. OpenAPI specs, versioning strategies, SDK generation, and developer portals.",
    badges: [
      { label: "tRPC", variant: "green" },
      { label: "GraphQL", variant: "cyan" },
      { label: "OpenAPI", variant: "muted" },
    ],
    featured: false,
  },
  {
    id: "cli",
    icon: Terminal,
    title: "CLI Tooling",
    description:
      "Internal command-line interfaces, automation scripts, and developer workflow tools that speed up daily operations.",
    badges: [
      { label: "Node.js", variant: "green" },
      { label: "Bash", variant: "muted" },
      { label: "Cobra CLI", variant: "amber" },
    ],
    featured: false,
  },
  {
    id: "infra",
    icon: Cpu,
    title: "Cloud Infrastructure",
    description:
      "Infrastructure-as-code provisioning. Multi-region deployments, auto-scaling groups, and cost-optimized resource allocation.",
    badges: [
      { label: "Terraform", variant: "cyan" },
      { label: "AWS", variant: "amber" },
      { label: "Vercel", variant: "green" },
    ],
    featured: false,
  },
] as const;

// ─── Component ──────────────────────────────────────────────
export function Features() {
  return (
    <section id="features" className="relative py-16 px-6">


      <div className="max-w-7xl mx-auto">

        {/* ── Section Header ─────────────────────────────── */}
        <div className="mb-16 max-w-2xl">
          <p className="section-label mb-3">{"// SYSTEM_MODULES"}</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-zk-white leading-tight mb-4">
            What We{" "}
            <span className="font-mono text-zk-green text-glow-sm">
              Engineer
            </span>
          </h2>
          <p className="text-zk-slate text-lg leading-relaxed">
            Each module is a self-contained system — independently deployable,
            composable with others, and production-hardened by default.
          </p>
        </div>

        {/* ── Feature Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-zk-border rounded-xl overflow-hidden">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.id}
                className="bg-zk-bg group p-6 flex flex-col gap-4 hover:bg-zk-green/[0.03] transition-colors duration-300 cursor-default"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Icon + Module ID */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center justify-center w-10 h-10 rounded-sm border border-zk-border bg-zk-green/5 group-hover:border-zk-green/30 group-hover:bg-zk-green/10 group-hover:shadow-glow-sm transition-all duration-300">
                    <Icon
                      size={18}
                      className="text-zk-green"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="font-mono text-[10px] text-zk-muted group-hover:text-zk-green/60 transition-colors">
                    MOD_{String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-zk-white font-semibold text-base leading-snug group-hover:text-zk-green transition-colors duration-200 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-zk-muted text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Badges */}
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {feature.badges.map((badge) => (
                    <Badge
                      key={badge.label}
                      variant={badge.variant as Parameters<typeof Badge>[0]["variant"]}
                    >
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Bottom metric strip ────────────────────────── */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: "8",    label: "Core Modules"     },
            { value: "100%", label: "TypeScript"        },
            { value: "A+",   label: "Security Rating"   },
            { value: "MIT",  label: "Open Internals"    },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <span className="font-mono text-2xl font-bold text-zk-green">
                {item.value}
              </span>
              <span className="font-mono text-[10px] text-zk-muted tracking-widest uppercase">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
