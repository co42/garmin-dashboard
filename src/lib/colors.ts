export const STATUS_COLORS: Record<string, string> = {
	PRODUCTIVE: '#22c55e',
	MAINTAINING: '#f59e0b',
	RECOVERY: '#14b8a6',
	DETRAINING: '#f97316',
	UNPRODUCTIVE: '#f97316',
	OVERREACHING: '#ef4444',
	PEAKING: '#22c55e',
	BASE: '#3b82f6',
};

export const READINESS_COLOR = (score: number): string => {
	if (score >= 80) return '#22c55e';
	if (score >= 40) return '#f59e0b';
	return '#ef4444';
};

export const ACWR_ZONE_COLORS = {
	low: '#3b82f6',       // < 0.8
	optimal: '#22c55e',   // 0.8 - 1.3
	high: '#f59e0b',      // 1.3 - 1.5
	veryHigh: '#ef4444',  // > 1.5
};

export const HRV_STATUS_COLORS: Record<string, string> = {
	BALANCED: '#22c55e',
	UNBALANCED: '#f59e0b',
	LOW: '#ef4444',
};

export const LOAD_COLORS = {
	aeroHigh: '#3b82f6',
	aeroLow: '#22c55e',
	anaerobic: '#a855f7',
};

export const FITNESS_TREND_LABEL: Record<number, { label: string; arrow: string; color: string }> = {
	1: { label: 'Improving', arrow: '↑', color: '#22c55e' },
	0: { label: 'Steady', arrow: '→', color: '#f59e0b' },
	[-1]: { label: 'Declining', arrow: '↓', color: '#ef4444' },
};
