/**
 * Date utilities for Asia/Karachi (PKT, UTC+5)
 */

export const TIMEZONE_PKT = "Asia/Karachi";

export function formatPKTDate(dateInput: Date | number | string): string {
  const d = typeof dateInput === "number" ? new Date(dateInput * 1000) : new Date(dateInput);
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: TIMEZONE_PKT,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatPKTDateTime(dateInput: Date | number | string): string {
  const d = typeof dateInput === "number" ? new Date(dateInput * 1000) : new Date(dateInput);
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: TIMEZONE_PKT,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function getTodayPKT(): string {
  // Returns YYYY-MM-DD in Asia/Karachi
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_PKT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}
