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

/** HR zone colors Z1–Z5 (Garmin spec: gray, blue, green, orange, red) */
export const ZONE_COLORS = [C.textDim, C.blue, C.green, C.orange, C.red] as const;

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

/** Load type colors (Garmin Training Load Focus: low aero=blue, high aero=orange, anaerobic=purple) */
export const LOAD_COLORS = {
	aeroHigh: C.orange,
	aeroLow: C.blue,
	anaerobic: C.purple,
} as const;

// =============================================================================
// Color functions
// =============================================================================

export function statusColor(status: string): string {
	const s = status.toUpperCase().replace(/_\d+$/, '');
	if (s === 'PRODUCTIVE') return C.green;
	if (s === 'PEAKING') return C.purple;
	if (s === 'MAINTAINING') return C.blue;
	if (s === 'BASE') return C.blue;
	if (s === 'RECOVERY') return C.amber;
	if (s === 'DETRAINING') return C.red;
	if (s === 'UNPRODUCTIVE') return C.red;
	if (s === 'OVERREACHING') return C.red;
	if (s === 'STRAINED') return C.red;
	return C.textSecondary;
}

export function readinessColor(score: number): string {
	if (score >= 95) return C.purple;  // Prime
	if (score >= 75) return C.blue;    // High
	if (score >= 50) return C.green;   // Moderate
	if (score >= 25) return C.orange;  // Low
	return C.red;                      // Poor
}

export function readinessLabel(score: number): string {
	if (score >= 95) return 'Prime';
	if (score >= 75) return 'High';
	if (score >= 50) return 'Moderate';
	if (score >= 25) return 'Low';
	return 'Poor';
}

export function acwrColor(status: string): string {
	if (status === 'LOW') return C.orange;
	if (status === 'OPTIMAL') return C.green;
	if (status === 'HIGH') return C.amber;
	return C.red;
}

export function hrvStatusColor(status: string): string {
	if (status === 'BALANCED') return C.green;
	if (status === 'UNBALANCED') return C.orange;
	return C.red;
}

/** Returns the ZONE_COLORS index (0-4) for a given HR, or -1 if unknown */
export function hrZoneIndex(hr: number, zones: { zone: number; min_bpm: number; max_bpm: number | null }[]): number {
	if (!hr || zones.length === 0) return -1;
	for (let i = zones.length - 1; i >= 0; i--) {
		if (hr >= zones[i].min_bpm) return i;
	}
	return 0;
}

export function hrZoneColor(hr: number, zones: { zone: number; min_bpm: number; max_bpm: number | null }[]): string {
	const idx = hrZoneIndex(hr, zones);
	return idx >= 0 ? ZONE_COLORS[idx] : C.textDim;
}

export function computeMedianLoad(loads: (number | null)[]): number {
	const valid = loads.filter((l): l is number => l != null).sort((a, b) => a - b);
	if (valid.length === 0) return 100;
	return valid[Math.floor(valid.length / 2)];
}

export function loadColor(load: number | null, medianLoad: number): string {
	if (load == null) return C.textDim;
	const ratio = load / medianLoad;
	if (ratio < 0.7) return C.blue;
	if (ratio < 1.0) return C.green;
	if (ratio < 1.4) return C.amber;
	return C.red;
}

/** Elevation gradient colors */
export const GRADIENT_COLORS = {
	vSteepDown: C.purple,  // < -15%
	steepDown: C.blue,     // -15% to -8%
	modDown: C.cyan,       // -8% to -2%
	flat: C.green,         // -2% to 2%
	modUp: C.amber,        // 2% to 8%
	steepUp: C.orange,     // 8% to 15%
	vSteepUp: C.red,       // > 15%
} as const;

/** Returns the gradient color for a given grade percentage */
export function gradColor(grade: number): string {
	if (grade < -15) return GRADIENT_COLORS.vSteepDown;
	if (grade < -8) return GRADIENT_COLORS.steepDown;
	if (grade < -2) return GRADIENT_COLORS.modDown;
	if (grade < 2) return GRADIENT_COLORS.flat;
	if (grade < 8) return GRADIENT_COLORS.modUp;
	if (grade < 15) return GRADIENT_COLORS.steepUp;
	return GRADIENT_COLORS.vSteepUp;
}

export function fitnessTrend(trend: string): { label: string; arrow: string; color: string } {
	const t = trend.toLowerCase();
	if (t === 'improving') return { label: 'Improving', arrow: '↑', color: C.green };
	if (t === 'stable') return { label: 'Stable', arrow: '→', color: C.amber };
	if (t === 'declining') return { label: 'Declining', arrow: '↓', color: C.red };
	return { label: trend || 'Unknown', arrow: '→', color: C.textSecondary };
}
