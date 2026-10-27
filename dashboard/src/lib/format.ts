// Small amounts matter here, a supervisor decision can cost a tenth of a cent
export function usd(value: number | null | undefined): string {
  const v = value ?? 0;
  if (v === 0) return "$0.00";
  if (Math.abs(v) < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Today's date in Brisbane, where the backend counts its days, weeks and months
export function brisbaneToday(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00`);
}

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The first day of a period of `days` days that ends today in Brisbane, as YYYY-MM-DD.
// /usage/daily counts back from this moment, so callers fetch one extra day and drop rows before this
export function firstDay(days: number): string {
  const d = brisbaneToday();
  d.setDate(d.getDate() - (days - 1));
  return isoDay(d);
}

export function tokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
}

export function duration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
