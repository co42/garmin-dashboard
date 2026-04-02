import type { DailyTrainingStatus } from './types.js';

// =============================================================================
// Runner Profile normalization
//
// All axes are normalized to 0–100 for a specific age/sex group.
//   0   = average untrained person in that group
//   100 = top 0.1% (elite) in that group
//
// To adjust for a different person, change PROFILE_AGE and PROFILE_SEX,
// then update the floor/ceil values in AXES based on the corresponding
// population percentile tables (see comments on each axis).
// =============================================================================

/** Age used for all population-based normalization thresholds */
export const PROFILE_AGE = 35;

/** Sex used for all population-based normalization thresholds */
export const PROFILE_SEX: 'male' | 'female' = 'male';

/** Human-readable label for tooltips */
export const PROFILE_LABEL = `${PROFILE_AGE}yo ${PROFILE_SEX}`;

// --- Axis definitions ---

export interface AxisDef {
	/** Display name on the radar / legend */
	name: string;
	/** Unit for raw value display */
	unit: string;
	/** Raw value corresponding to score 0 */
	floor: number;
	/** Raw value corresponding to score 100 */
	ceil: number;
	/** Human-readable description of what 0 means */
	zeroLabel: string;
	/** Human-readable description of what 100 means */
	hundredLabel: string;
	/** One-line scale description for trend chart tooltip */
	scaleTip: string;
	/** Tooltip description for legend hover */
	tip: string;
}

export const AXES: Record<string, AxisDef> = {
	vo2max: {
		name: 'VO2max',
		unit: '',
		floor: 30,
		ceil: 70,
		zeroLabel: '30 mL/kg/min (beginner)',
		hundredLabel: '70 (national competitive)',
		scaleTip: '0% = 30 mL/kg/min · 100% = 70',
		tip: 'Maximum oxygen uptake — the gold standard of aerobic fitness.\nGarmin estimates it from pace and heart rate.\nScale: 30 (beginner) → 70 (national competitive).',
	},
	endurance: {
		name: 'Endurance',
		unit: '',
		floor: 1500,
		ceil: 9500,
		zeroLabel: '1,500 (casual)',
		hundredLabel: '9,500 (elite)',
		scaleTip: '0% = 1,500 · 100% = 9,500',
		tip: 'Garmin endurance score from training history.\nReflects sustained effort capacity over long durations.\nScale: 1,500 (casual) → 9,500 (elite).',
	},
	balance: {
		name: 'Balance',
		unit: '%',
		floor: 0,
		ceil: 100,
		zeroLabel: 'all load types out of range',
		hundredLabel: 'all load types in target range',
		scaleTip: '0% = all out of range · 100% = all in target',
		tip: 'Training load balance across 3 types (aerobic high, aerobic low, anaerobic).\nEach type scores 33% when within Garmin target range, tapers outside.\n100% = all types in range.',
	},
	hillStr: {
		name: 'Hill Str',
		unit: '',
		floor: 5,
		ceil: 90,
		zeroLabel: '5 (flat-only)',
		hundredLabel: '90 (elite mountain)',
		scaleTip: '0% = 5 · 100% = 90',
		tip: 'Hill strength — power on steep climbs.\nFrom Garmin hill score analysis.\nScale: 5 (flat-only) → 90 (elite mountain).',
	},
	hillEnd: {
		name: 'Hill End',
		unit: '',
		floor: 5,
		ceil: 90,
		zeroLabel: '5 (no climbing)',
		hundredLabel: '90 (elite climber)',
		scaleTip: '0% = 5 · 100% = 90',
		tip: 'Hill endurance — sustained climbing ability.\nFrom Garmin hill score analysis.\nScale: 5 (no climbing) → 90 (elite climber).',
	},
	hill: {
		name: 'Hill',
		unit: '',
		floor: 5,
		ceil: 90,
		zeroLabel: '5 (flat-only)',
		hundredLabel: '90 (elite mountain)',
		scaleTip: '0% = 5 · 100% = 90',
		tip: 'Garmin hill score — overall climbing ability.\nCombines strength and endurance on hills.\nScale: 5 (flat-only) → 90 (elite mountain).',
	},
	productivity: {
		name: 'Productivity',
		unit: '%',
		floor: 0,
		ceil: 100,
		zeroLabel: 'no productive days',
		hundredLabel: 'all days productive',
		scaleTip: '0% = no productive days · 100% = all productive',
		tip: 'Weighted training quality over 30 days.\nProductive/Peaking=100%, Maintaining=70%, Base/Recovery=50%,\nOverreaching=40%, Unproductive=20%, Strained=10%, Detraining=0%.',
	},
};

/** Axis order for the trend chart (hill split into str/end) */
export const AXIS_ORDER = ['vo2max', 'endurance', 'balance', 'hillStr', 'hillEnd'] as const;

/** Axis order for the radar (hill as overall, + productivity) */
export const RADAR_AXIS_ORDER = ['vo2max', 'endurance', 'balance', 'productivity', 'hill'] as const;

/** Colors per axis — used by both charts */
export const AXIS_COLORS: Record<string, string> = {
	vo2max: '#22c55e',
	endurance: '#3b82f6',
	balance: '#f59e0b',
	hillStr: '#a855f7',
	hillEnd: '#06b6d4',
	hill: '#a855f7',
	productivity: '#ec4899',
};

// --- Normalization functions ---

/** Normalize a raw value to 0–100 using the axis definition */
export function normalize(axisKey: string, rawValue: number): number {
	const axis = AXES[axisKey];
	if (!axis) return 0;
	return Math.max(0, Math.min(100, Math.round(((rawValue - axis.floor) / (axis.ceil - axis.floor)) * 100)));
}

/** Format a raw value for display (with unit if applicable) */
export function formatRaw(axisKey: string, rawValue: number): string {
	const axis = AXES[axisKey];
	if (!axis) return String(rawValue);
	switch (axisKey) {
		case 'vo2max': return rawValue.toFixed(1);
		case 'endurance': return rawValue.toLocaleString();
		case 'balance':
		case 'productivity': return Math.round(rawValue) + '%';
		case 'hillStr':
		case 'hillEnd':
		case 'hill': return String(Math.round(rawValue));
		default: return String(rawValue);
	}
}

/** Format a raw delta value for display (with sign) */
export function formatRawDelta(axisKey: string, delta: number): string {
	const sign = delta > 0 ? '+' : '';
	switch (axisKey) {
		case 'vo2max': return sign + delta.toFixed(1);
		case 'endurance': return sign + Math.round(delta).toLocaleString();
		case 'balance':
		case 'productivity': return sign + Math.round(delta) + '%';
		case 'hillStr':
		case 'hillEnd':
		case 'hill': return sign + Math.round(delta);
		default: return sign + String(delta);
	}
}

/** Weight each training status for productivity scoring */
const STATUS_WEIGHT: Record<string, number> = {
	PRODUCTIVE: 1.0,
	PEAKING: 1.0,
	MAINTAINING: 0.7,
	BASE: 0.5,
	RECOVERY: 0.5,
	UNPRODUCTIVE: 0.2,
	OVERREACHING: 0.4,
	STRAINED: 0.1,
	DETRAINING: 0,
};

/**
 * Weighted productivity score over a 30-day window ending at `atDate`.
 * Each day contributes its status weight (1.0 for Productive, 0.7 for Maintaining, etc.)
 * Returns 0–100. Returns -1 if no data in the window.
 */
export function computeProductivity(history: DailyTrainingStatus[], atDate?: string): number {
	const endDate = atDate ?? new Date().toISOString().slice(0, 10);
	const cutoff = new Date(new Date(endDate + 'T00:00:00Z').getTime() - 30 * 86400000).toISOString().slice(0, 10);
	const w = history.filter(s => s.date >= cutoff && s.date <= endDate);
	if (w.length === 0) return -1;
	const total = w.reduce((sum, s) => {
		const base = s.status.replace(/_\d+$/, '');
		return sum + (STATUS_WEIGHT[base] ?? 0);
	}, 0);
	return Math.round((total / w.length) * 100);
}

/**
 * Compute load balance score from a DailyTrainingStatus.
 *
 * Each of the 3 load types (aero high, aero low, anaerobic) contributes up
 * to 33.3 points. A type scores full points when its value is within
 * [targetMin, targetMax]. Outside that range, the score tapers linearly —
 * hitting 0 when the value is more than 100% away from the nearest boundary.
 *
 * Returns 0–100. Returns -1 if targets are all zero (no data).
 */
export function computeBalance(s: DailyTrainingStatus): number {
	const types = [
		{ value: s.monthly_load_aerobic_high, min: s.monthly_load_aerobic_high_target_min, max: s.monthly_load_aerobic_high_target_max },
		{ value: s.monthly_load_aerobic_low, min: s.monthly_load_aerobic_low_target_min, max: s.monthly_load_aerobic_low_target_max },
		{ value: s.monthly_load_anaerobic, min: s.monthly_load_anaerobic_target_min, max: s.monthly_load_anaerobic_target_max },
	];

	// No targets = no data
	if (types.every(t => t.min === 0 && t.max === 0)) return -1;

	let total = 0;
	for (const t of types) {
		const range = t.max - t.min;
		if (range <= 0) continue;

		if (t.value >= t.min && t.value <= t.max) {
			// In range: full 33.3 points
			total += 33.33;
		} else if (t.value < t.min) {
			// Below range: taper to 0 over a distance of `range`
			const deficit = t.min - t.value;
			total += 33.33 * Math.max(0, 1 - deficit / range);
		} else {
			// Above range: taper to 0 over a distance of `range`
			const surplus = t.value - t.max;
			total += 33.33 * Math.max(0, 1 - surplus / range);
		}
	}

	return Math.max(0, Math.min(100, Math.round(total)));
}
