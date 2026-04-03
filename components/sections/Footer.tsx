// components/sections/Footer.tsx
// Minimal terminal-style footer with copyright, nav links, and status.

import { Terminal } from "lucide-react";

const FOOTER_LINKS = [
  { label: "Privacy",  href: "#" },
  { label: "Terms",    href: "#" },
  { label: "Security", href: "#" },
  { label: "Status",   href: "#" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-zk-border bg-[rgba(5,5,5,0.92)] backdrop-blur-[16px]">
      {/* Top gradient glow */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zk-green/20 to-transparent"
      />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">

          {/* Logo + copyright */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-sm border border-zk-border bg-zk-green/5">
              <Terminal size={12} className="text-zk-green" />
            </div>
            <p className="font-mono text-xs text-zk-muted">
              <span className="text-zk-green/80">ZEKO_OS</span>
              {" "}©{" "}{year} — Built by Zakariya Jabbar
            </p>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-zk-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-zk-green animate-pulse shadow-glow-sm" aria-hidden="true" />
            ALL SYSTEMS OPERATIONAL
          </div>

          {/* Links */}
          <nav aria-label="Footer navigation">
            <ul className="flex items-center gap-4">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="font-mono text-[11px] text-zk-muted/60 hover:text-zk-green tracking-widest uppercase transition-colors duration-150"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

      </div>
    </footer>
  );
}
