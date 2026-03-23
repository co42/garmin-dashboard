// =============================================================================
// Color palette — single source of truth
// =============================================================================

export const C = {
	// Semantic
	green: '#22c55e',
	teal: '#14b8a6',
	amber: '#f59e0b',
	orange: '#fb923c',
	red: '#ef4444',
	blue: '#3b82f6',
	purple: '#a855f7',
	cyan: '#06b6d4',

	// Text
	text: '#e8e8ed',
	textSecondary: '#8888a0',
	textDim: '#6a6a7e',

	// Chrome
	card: '#13131a',
	cardBorder: '#1e1e2a',
	hover: '#2a2a3a',
} as const;

/** HR zone colors Z1–Z5 */
export const ZONE_COLORS = [C.blue, C.green, C.amber, C.red, C.purple] as const;

/** Reusable tooltip config for echarts */
export const CHART_TOOLTIP = {
	confine: true,
	backgroundColor: C.cardBorder,
	borderColor: C.hover,
	textStyle: { color: C.text, fontSize: 12 },
} as const;

/** Reusable axis styles for echarts */
export const CHART_AXIS = {
	axisLine: { lineStyle: { color: C.hover } },
	axisLabel: { color: C.textDim, fontSize: 10 },
	splitLine: { lineStyle: { color: C.cardBorder } },
} as const;

/** Load type colors (aerobic high, aerobic low, anaerobic) */
export const LOAD_COLORS = {
	aeroHigh: C.blue,
	aeroLow: C.green,
	anaerobic: C.purple,
} as const;

// =============================================================================
// Color functions
// =============================================================================

export function statusColor(status: string): string {
	const s = status.toUpperCase().replace(/_\d+$/, '');
	if (s === 'PRODUCTIVE') return C.green;
	if (s === 'PEAKING') return C.green;
	if (s === 'MAINTAINING') return C.blue;
	if (s === 'BASE') return C.blue;
	if (s === 'RECOVERY') return C.teal;
	if (s === 'DETRAINING') return C.orange;
	if (s === 'UNPRODUCTIVE') return C.red;
	if (s === 'OVERREACHING') return C.red;
	if (s === 'STRAINED') return C.red;
	return C.textSecondary;
}

export function readinessColor(score: number): string {
	if (score >= 80) return C.green;
	if (score >= 40) return C.amber;
	return C.red;
}

export function acwrColor(status: string): string {
	if (status === 'LOW') return C.orange;
	if (status === 'OPTIMAL') return C.green;
	if (status === 'HIGH') return C.amber;
	return C.red;
}

export function hrvStatusColor(status: string): string {
	if (status === 'BALANCED') return C.green;
	if (status === 'UNBALANCED') return C.amber;
	return C.red;
}

export function fitnessTrend(trend: number): { label: string; arrow: string; color: string } {
	if (trend >= 2) return { label: 'Improving', arrow: '↑', color: C.green };
	if (trend === 1) return { label: 'Steady', arrow: '→', color: C.amber };
	if (trend === 0) return { label: 'Steady', arrow: '→', color: C.textSecondary };
	return { label: 'Declining', arrow: '↓', color: C.red };
}
