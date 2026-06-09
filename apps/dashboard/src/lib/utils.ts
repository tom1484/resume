import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Defense in depth: the API is the source of truth for numeric types, but pg
// returns numeric/bigint as strings, so a missed coercion upstream would feed a
// string here and `.toFixed` would hard-crash the whole page ("e.toFixed is not
// a function"). Coerce with Number() and guard NaN so a stray value degrades to
// "—" instead of a white screen.
export function fmtUsd(n: number | string | null | undefined): string {
  if (n == null) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '$0.00';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function fmtScore(n: number | string | null | undefined): string {
  if (n == null) return '—';
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(3) : '—';
}
