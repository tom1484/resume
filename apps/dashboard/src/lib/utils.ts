import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export function fmtScore(n: number | null | undefined): string {
  return n == null ? '—' : n.toFixed(3);
}
