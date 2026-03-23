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
	/** Whether the raw scale is inverted (lower raw = higher score, e.g. pace) */
	inverted?: boolean;
}

export const AXES: Record<string, AxisDef> = {
	vo2max: {
		// ACSM percentile tables for PROFILE_SEX, age range including PROFILE_AGE:
		// Males 30-39: 50th percentile ≈ 40 mL/kg/min, 99.9th ≈ 65
		name: 'VO2max',
		floor: 40,
		ceil: 65,
		zeroLabel: '40 mL/kg/min (untrained)',
		hundredLabel: '65 (elite)',
		scaleTip: '0 = 40 mL/kg/min (untrained) · 100 = 65 (elite)',
	},
	speed: {
		// 5K race time for PROFILE_SEX ~PROFILE_AGE:
		// Untrained ≈ 30:00 (1800s), elite ≈ 14:30 (870s)
		// Inverted: faster (lower seconds) = higher score
		name: 'Speed',
		floor: 1800,
		ceil: 870,
		zeroLabel: '6:00 /km pace (untrained)',
		hundredLabel: '2:54 /km pace (elite)',
		scaleTip: '0 = 6:00 /km pace · 100 = 2:54 /km pace',
		inverted: true,
	},
	endurance: {
		// Garmin endurance score 0–10,000:
		// Casual jogger ≈ 3,500. Elite threshold is 8,800+, using 9,500 as practical ceiling.
		name: 'Endurance',
		floor: 3500,
		ceil: 9500,
		zeroLabel: '3,500 (casual jogger)',
		hundredLabel: '9,500 (elite)',
		scaleTip: '0 = 3,500 (casual jogger) · 100 = 9,500 (elite)',
	},
	balance: {
		// Garmin training load balance — how well your training mix matches target ranges
		// for aerobic high, aerobic low, and anaerobic.
		// Score: each of the 3 types contributes up to 33.3 points when in range.
		// Out of range = scaled down based on distance from target.
		// 100 = all three in range, 0 = all three completely off.
		name: 'Balance',
		floor: 0,
		ceil: 100,
		zeroLabel: 'all load types out of range',
		hundredLabel: 'all load types in target range',
		scaleTip: '0 = all out of range · 100 = all in target',
	},
	hillStr: {
		// Garmin hill score — strength component (0–100):
		// Untrained flat runner ≈ 10, elite mountain runner ≈ 90
		name: 'Hill Str',
		floor: 10,
		ceil: 90,
		zeroLabel: '10 (flat runner)',
		hundredLabel: '90 (mountain runner)',
		scaleTip: '0 = 10 (flat runner) · 100 = 90 (mountain runner)',
	},
	hillEnd: {
		// Garmin hill score — endurance component (0–100):
		// Same scale as strength
		name: 'Hill End',
		floor: 10,
		ceil: 90,
		zeroLabel: '10 (no climbing)',
		hundredLabel: '90 (elite climber)',
		scaleTip: '0 = 10 (no climbing) · 100 = 90 (elite climber)',
	},
};

/** Canonical axis order — used by both radar and trend chart */
export const AXIS_ORDER = ['vo2max', 'speed', 'endurance', 'balance', 'hillStr', 'hillEnd'] as const;

/** Colors per axis — used by both charts */
export const AXIS_COLORS: Record<string, string> = {
	vo2max: '#22c55e',
	speed: '#ef4444',
	endurance: '#3b82f6',
	balance: '#f59e0b',
	hillStr: '#a855f7',
	hillEnd: '#06b6d4',
};

// --- Normalization functions ---

/** Normalize a raw value to 0–100 using the axis definition */
export function normalize(axisKey: string, rawValue: number): number {
	const axis = AXES[axisKey];
	if (!axis) return 0;
	if (axis.inverted) {
		return Math.max(0, Math.min(100, Math.round(((axis.floor - rawValue) / (axis.floor - axis.ceil)) * 100)));
	}
	return Math.max(0, Math.min(100, Math.round(((rawValue - axis.floor) / (axis.ceil - axis.floor)) * 100)));
}

/**
 * Estimate 5K time from VO2max using the ACSM relationship.
 * Used by the trend chart where we don't have per-week race predictions.
 * Linear interpolation: VO2max 40 → 1800s, VO2max 65 → 870s.
 */
export function estimate5kFromVo2(vo2: number): number {
	return AXES.speed.floor - (vo2 - AXES.vo2max.floor) * ((AXES.speed.floor - AXES.speed.ceil) / (AXES.vo2max.ceil - AXES.vo2max.floor));
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
