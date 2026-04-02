export function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatPace(seconds: number, meters: number): string {
	if (!meters) return '-';
	const pace = Math.round(seconds / (meters / 1000));
	const m = Math.floor(pace / 60);
	const s = pace % 60;
	return `${m}:${s.toString().padStart(2, '0')} /km`;
}

export function formatDistance(meters: number): string {
	return (meters / 1000).toFixed(1);
}

export function formatDate(dateStr: string): string {
	const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
	return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatDateTime(dateStr: string): string {
	const d = new Date(dateStr.replace(' ', 'T'));
	return d.toLocaleDateString('en-GB', {
		day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
	});
}

export function formatRaceTime(seconds: number): string {
	return formatTime(seconds);
}

export function formatRacePace(seconds: number, km: number): string {
	const pace = Math.round(seconds / km);
	const m = Math.floor(pace / 60);
	const s = pace % 60;
	return `${m}:${s.toString().padStart(2, '0')} /km`;
}

export function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

/** Parse "M:SS /km" pace string to total seconds */
export function parsePace(pace: string): number {
	const match = pace.match(/(\d+):(\d+)/);
	if (!match) return 0;
	return parseInt(match[1]) * 60 + parseInt(match[2]);
}
