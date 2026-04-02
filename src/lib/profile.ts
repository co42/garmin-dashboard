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
}

export const AXES: Record<string, AxisDef> = {
	vo2max: {
		// Percentile among male runners ~35yo (Running Level + VDOT equivalence):
		// ~5th pct runner ≈ 30, ~20th pct ≈ 35, ~50th pct ≈ 42, ~95th pct ≈ 57, ~99.9th pct ≈ 70
		name: 'VO2max',
		unit: '',
		floor: 30,
		ceil: 70,
		zeroLabel: '30 mL/kg/min (beginner)',
		hundredLabel: '70 (national competitive)',
		scaleTip: '0% = 30 mL/kg/min · 100% = 70',
	},
	endurance: {
		// Garmin endurance score 0–10,000:
		// ~5th pct ≈ 1,500 (new/casual), ~50th ≈ 5,500, ~99.5th ≈ 9,500
		name: 'Endurance',
		unit: '',
		floor: 1500,
		ceil: 9500,
		zeroLabel: '1,500 (casual)',
		hundredLabel: '9,500 (elite)',
		scaleTip: '0% = 1,500 · 100% = 9,500',
	},
	balance: {
		// Training load balance — how well your mix matches target ranges.
		// 0 = all three types out of range, 100 = all in range.
		name: 'Balance',
		unit: '%',
		floor: 0,
		ceil: 100,
		zeroLabel: 'all load types out of range',
		hundredLabel: 'all load types in target range',
		scaleTip: '0% = all out of range · 100% = all in target',
	},
	hillStr: {
		// Garmin hill score — strength component (0–100):
		// ~5th pct ≈ 5 (flat-only), ~50th ≈ 35, ~99.5th ≈ 90
		name: 'Hill Str',
		unit: '',
		floor: 5,
		ceil: 90,
		zeroLabel: '5 (flat-only)',
		hundredLabel: '90 (elite mountain)',
		scaleTip: '0% = 5 · 100% = 90',
	},
	hillEnd: {
		// Garmin hill score — endurance component (0–100):
		// Same scale as strength
		name: 'Hill End',
		unit: '',
		floor: 5,
		ceil: 90,
		zeroLabel: '5 (no climbing)',
		hundredLabel: '90 (elite climber)',
		scaleTip: '0% = 5 · 100% = 90',
	},
	hill: {
		// Garmin hill score — overall composite (0–100):
		name: 'Hill',
		unit: '',
		floor: 5,
		ceil: 90,
		zeroLabel: '5 (flat-only)',
		hundredLabel: '90 (elite mountain)',
		scaleTip: '0% = 5 · 100% = 90',
	},
	productivity: {
		// % of productive days in rolling 30-day window
		name: 'Productivity',
		unit: '%',
		floor: 0,
		ceil: 100,
		zeroLabel: 'no productive days',
		hundredLabel: 'all days productive',
		scaleTip: '0% = no productive days · 100% = all productive',
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

/**
 * Compute % of productive days in a 30-day window ending at `atDate`.
 * "Productive" = status starts with PRODUCTIVE or PEAKING.
 * Returns 0–100. Returns -1 if no data in the window.
 */
export function computeProductivity(history: DailyTrainingStatus[], atDate?: string): number {
	const endDate = atDate ?? new Date().toISOString().slice(0, 10);
	const cutoff = new Date(new Date(endDate + 'T00:00:00Z').getTime() - 30 * 86400000).toISOString().slice(0, 10);
	const window = history.filter(s => s.date >= cutoff && s.date <= endDate);
	if (window.length === 0) return -1;
	const productive = window.filter(s => {
		const base = s.status.replace(/_\d+$/, '');
		return base === 'PRODUCTIVE' || base === 'PEAKING';
	}).length;
	return Math.round((productive / window.length) * 100);
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
