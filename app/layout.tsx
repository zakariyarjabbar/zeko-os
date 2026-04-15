// app/layout.tsx
// Root layout — sets up fonts, metadata, and global structure.

import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// ─── Font Configuration ──────────────────────────────────────
// JetBrains Mono → all technical/monospace elements
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

// Space Grotesk → body text (clean, slightly technical feel)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

// ─── Viewport (themeColor must live here, not in metadata) ──
export const viewport: Viewport = {
  themeColor: "#050505",
};

// ─── Metadata ────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "zeko OS",
  description:
    "Zeko OS is a precision-engineered digital environment built for performance, security, and scale. Initializing now.",
  keywords: [
    "Zeko OS",
    "Zakariya Jabbar",
    "Full-Stack Development",
    "System Architecture",
    "Terminal",
    "High Performance",
  ],
  authors: [{ name: "Zakariya Jabbar", url: "https://zeko.os" }],
  openGraph: {
    title: "Zeko OS",
    description: "High-Performance Digital Environment",
    type: "website",
  },
};

// ─── Root Layout ─────────────────────────────────────────────
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        {/* Preconnect to Google Fonts CDN for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
