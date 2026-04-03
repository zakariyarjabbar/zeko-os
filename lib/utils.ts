// lib/utils.ts
// Shared utility functions used throughout the project.

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — Conditional class name merger.
 * Combines clsx (conditional class logic) with tailwind-merge
 * (deduplication of conflicting Tailwind classes).
 *
 * Usage:
 *   cn("px-4 py-2", isActive && "bg-green-500", "px-6") → "py-2 bg-green-500 px-6"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * formatStat() — Format numbers for display in System Stats.
 * e.g., 1420 → "1.4K", 1000000 → "1M"
 */
export function formatStat(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/**
 * clamp() — Constrain a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * sleep() — Promise-based delay helper (useful for animations/effects).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * generateId() — Lightweight unique ID for keying list items.
 */
export function generateId(prefix = "zk"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
