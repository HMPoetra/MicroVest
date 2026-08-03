import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency to IDR
export function formatIDR(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) {
      return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
    }
    if (Math.abs(value) >= 1_000) {
      return `Rp ${(value / 1_000).toFixed(0)}rb`;
    }
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format percentage
export function formatPct(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Format date to Indonesian locale
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

// Format date short
export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr));
}

// Asset type badge config
export const ASSET_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; badgeClass: string }
> = {
  emas: { label: "Emas", color: "#fbbf24", badgeClass: "badge-warning" },
  reksadana: { label: "Reksa Dana", color: "#60a5fa", badgeClass: "badge-info" },
  obligasi: { label: "Obligasi", color: "#34d399", badgeClass: "badge-success" },
};

// Chart colors
export const CHART_COLORS = {
  emas: "#fbbf24",
  reksadana: "#60a5fa",
  obligasi: "#34d399",
  profit: "#34d399",
  loss: "#f87171",
  neutral: "#94a3b8",
  primary: "#10b981",
  accent: "#3b82f6",
};

// Calculate percentage change
export function calcPctChange(current: number, base: number): number {
  if (base === 0) return 0;
  return ((current - base) / base) * 100;
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}

// Sleep helper
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
