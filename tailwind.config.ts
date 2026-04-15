import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ─── Color Palette ──────────────────────────────────────────────────
      colors: {
        // Backgrounds
        "zk-bg":       "#050505",
        "zk-bg-alt":   "#0a0f0a",
        "zk-surface":  "#0d1117",
        "zk-border":   "rgba(0, 255, 65, 0.12)",
        "zk-border-md":"rgba(0, 255, 65, 0.25)",

        // Terminal Green spectrum
        "zk-green":    "#00FF41",
        "zk-green-dim":"#00ea65",
        "zk-green-xs": "rgba(0, 255, 65, 0.06)",
        "zk-green-sm": "rgba(0, 255, 65, 0.12)",
        "zk-green-md": "rgba(0, 255, 65, 0.25)",
        "zk-green-lg": "rgba(0, 255, 65, 0.45)",

        // Text
        "zk-white":    "#F0F6F0",
        "zk-muted":    "#6B7A6B",
        "zk-slate":    "#8B9E8B",

        // Danger / Warning accents
        "zk-amber":    "#FFB800",
        "zk-red":      "#FF3B3B",
        "zk-cyan":     "#00D4FF",
      },

      // ─── Typography ─────────────────────────────────────────────────────
      fontFamily: {
        sans:  ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono:  ["var(--font-jetbrains-mono)", "Fira Code", "monospace"],
      },

      // ─── Custom Animations ───────────────────────────────────────────────
      keyframes: {
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0" },
        },
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(0,255,65,0.3), 0 0 10px rgba(0,255,65,0.1)" },
          "50%":       { boxShadow: "0 0 15px rgba(0,255,65,0.6), 0 0 30px rgba(0,255,65,0.2)" },
        },
        // Matrix-decode: incoming SSE messages flash green then settle to normal text colour
        "msg-decode": {
          "0%":   {
            opacity: "0",
            filter:  "brightness(4) blur(1.5px)",
            color:   "#00FF41",
            letterSpacing: "0.08em",
          },
          "40%":  {
            opacity: "0.85",
            filter:  "brightness(2) blur(0px)",
            color:   "#00FF41",
            letterSpacing: "0.02em",
          },
          "100%": {
            opacity: "1",
            filter:  "brightness(1) blur(0px)",
            color:   "inherit",
            letterSpacing: "normal",
          },
        },
      },
      animation: {
        "cursor-blink":  "cursor-blink 1s step-end infinite",
        "fade-in-up":    "fade-in-up 0.6s ease-out forwards",
        "glow-pulse":    "glow-pulse 2s ease-in-out infinite",
        "msg-decode":    "msg-decode 0.55s ease-out forwards",
      },

      // ─── Box Shadows ─────────────────────────────────────────────────────
      boxShadow: {
        "glow-sm":  "0 0 8px rgba(0,255,65,0.3)",
        "glow-md":  "0 0 20px rgba(0,255,65,0.4), 0 0 40px rgba(0,255,65,0.1)",
        "glow-lg":  "0 0 40px rgba(0,255,65,0.5), 0 0 80px rgba(0,255,65,0.15)",
        "glow-btn": "0 0 15px rgba(0,255,65,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card":     "0 4px 24px rgba(0,0,0,0.6), 0 1px 0 rgba(0,255,65,0.08)",
      },

      // ─── Backdrop Blur ───────────────────────────────────────────────────
      backdropBlur: {
        xs: "2px",
      },

      // ─── Grid Template ───────────────────────────────────────────────────
      gridTemplateColumns: {
        "features": "repeat(auto-fit, minmax(300px, 1fr))",
      },
    },
  },
  plugins: [],
};

export default config;
