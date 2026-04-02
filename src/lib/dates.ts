/**
 * Date utilities — all date logic uses UTC to avoid timezone bugs.
 *
 * Rule: date strings from the API/DB ("2026-03-23" or "2026-03-23 17:04:15")
 * represent wall-clock dates. We treat them as UTC for all calculations
 * (week boundaries, grouping, comparisons). Only display formatting uses
 * the browser's local timezone.
 *
 * This avoids the classic JS pitfall where `new Date("2026-03-23")` is UTC
 * but `getDay()` returns local time, causing ±1 day shifts in CET/etc.
 */

/** Parse any date string to UTC midnight. Extracts YYYY-MM-DD, ignores time. */
export function utcDate(s: string): Date {
	return new Date(s.slice(0, 10) + 'T00:00:00Z');
}

/** Format a UTC Date as "YYYY-MM-DD". */
export function fmtDateISO(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Today's date as "YYYY-MM-DD" in the user's local timezone. */
export function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the week containing the given date string (ISO Monday-start). */
export function weekMonday(dateStr: string): string {
	const d = utcDate(dateStr);
	const day = d.getUTCDay();
	d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
	return fmtDateISO(d);
}

/** Add N days to a date string. Returns "YYYY-MM-DD". */
export function addDays(dateStr: string, n: number): string {
	const d = utcDate(dateStr);
	d.setUTCDate(d.getUTCDate() + n);
	return fmtDateISO(d);
}

/** Days between two date strings (positive if b > a). */
export function daysBetween(a: string, b: string): number {
	return Math.round((utcDate(b).getTime() - utcDate(a).getTime()) / 86400000);
}
