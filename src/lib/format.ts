/** Format seconds into "M:SS" or "H:MM:SS" */
export function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) {
		return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}
	return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format seconds into pace "M:SS /km" */
export function formatPace(seconds: number, meters: number): string {
	if (!meters) return '-';
	const paceSeconds = seconds / (meters / 1000);
	const m = Math.floor(paceSeconds / 60);
	const s = Math.floor(paceSeconds % 60);
	return `${m}:${s.toString().padStart(2, '0')} /km`;
}

/** Format meters to km with 1 decimal */
export function formatDistance(meters: number): string {
	return (meters / 1000).toFixed(1);
}

/** Format a date string to "Mar 13" */
export function formatDate(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format a date string to "Mar 13, 17:18" */
export function formatDateTime(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
}

/** Days between two dates */
export function daysBetween(a: string, b: string): number {
	const msPerDay = 86400000;
	return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

/** Race prediction seconds to formatted time */
export function formatRaceTime(seconds: number): string {
	return formatTime(seconds);
}

/** Race prediction seconds to pace /km */
export function formatRacePace(seconds: number, distanceKm: number): string {
	const paceSeconds = seconds / distanceKm;
	const m = Math.floor(paceSeconds / 60);
	const s = Math.floor(paceSeconds % 60);
	return `${m}:${s.toString().padStart(2, '0')} /km`;
}
