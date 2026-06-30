import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toPersianDigits(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(val).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
}

export function formatPersianPrice(num: number | null | undefined): string {
  if (num === null || num === undefined) return '۰';
  // Standard format with thousands separator
  const formatted = num.toLocaleString('en-US');
  return toPersianDigits(formatted);
}

export function formatPersianNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '';
  return toPersianDigits(val);
}
