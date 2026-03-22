export function statusColor(status: string): string {
	// Strip trailing _N (e.g. UNPRODUCTIVE_2 → UNPRODUCTIVE)
	const s = status.toUpperCase().replace(/_\d+$/, '');
	// Check specific statuses before substrings to avoid UNPRODUCTIVE matching PRODUCTIVE
	if (s === 'PRODUCTIVE') return '#22c55e';
	if (s === 'PEAKING') return '#22c55e';
	if (s === 'MAINTAINING') return '#3b82f6';
	if (s === 'BASE') return '#3b82f6';
	if (s === 'RECOVERY') return '#14b8a6';
	if (s === 'DETRAINING') return '#f97316';
	if (s === 'UNPRODUCTIVE') return '#ef4444';
	if (s === 'OVERREACHING') return '#ef4444';
	if (s === 'STRAINED') return '#ef4444';
	return '#8888a0';
}

export function readinessColor(score: number): string {
	if (score >= 80) return '#22c55e';
	if (score >= 40) return '#f59e0b';
	return '#ef4444';
}

export function acwrColor(status: string): string {
	if (status === 'LOW') return '#f97316';      // orange — undertraining
	if (status === 'OPTIMAL') return '#22c55e';   // green — sweet spot
	if (status === 'HIGH') return '#f59e0b';      // amber — watch out
	return '#ef4444';                             // red — overreaching
}

export function hrvStatusColor(status: string): string {
	if (status === 'BALANCED') return '#22c55e';
	if (status === 'UNBALANCED') return '#f59e0b';
	return '#ef4444';
}

export function fitnessTrend(trend: number): { label: string; arrow: string; color: string } {
	if (trend >= 2) return { label: 'Improving', arrow: '↑', color: '#22c55e' };
	if (trend === 1) return { label: 'Steady', arrow: '→', color: '#f59e0b' };
	if (trend === 0) return { label: 'Steady', arrow: '→', color: '#8888a0' };
	return { label: 'Declining', arrow: '↓', color: '#ef4444' };
}

export const LOAD_COLORS = {
	aeroHigh: '#3b82f6',
	aeroLow: '#22c55e',
	anaerobic: '#a855f7',
};
