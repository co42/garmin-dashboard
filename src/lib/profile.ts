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
	hillStr: {
		name: 'Hill Str',
		unit: '',
		floor: 0,
		ceil: 100,
		zeroLabel: '0 (no climbing)',
		hundredLabel: '100 (elite)',
		scaleTip: 'Garmin score 0–100',
		tip: 'Hill strength — power on steep climbs.\nGarmin score, already 0–100.\n\nZones:\n95–100 Elite · 85–94 Expert\n70–84 Skilled · 50–69 Trained\n25–49 Challenger · 1–24 Recreational',
	},
	hillEnd: {
		name: 'Hill End',
		unit: '',
		floor: 0,
		ceil: 100,
		zeroLabel: '0 (no climbing)',
		hundredLabel: '100 (elite)',
		scaleTip: 'Garmin score 0–100',
		tip: 'Hill endurance — sustained climbing ability.\nGarmin score, already 0–100.\n\nZones:\n95–100 Elite · 85–94 Expert\n70–84 Skilled · 50–69 Trained\n25–49 Challenger · 1–24 Recreational',
	},
	hill: {
		name: 'Hill',
		unit: '',
		floor: 0,
		ceil: 100,
		zeroLabel: '0 (no climbing)',
		hundredLabel: '100 (elite)',
		scaleTip: 'Garmin score 0–100',
		tip: 'Garmin hill score — overall climbing ability.\nCombines strength and endurance. Already 0–100.\n\nZones:\n95–100 Elite · 85–94 Expert\n70–84 Skilled · 50–69 Trained\n25–49 Challenger · 1–24 Recreational',
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
export const AXIS_ORDER = ['vo2max', 'endurance', 'hillStr', 'hillEnd'] as const;

/** Axis order for the radar (hill as overall, + productivity) */
export const RADAR_AXIS_ORDER = ['vo2max', 'endurance', 'hill', 'productivity'] as const;

/** Colors per axis — used by both charts */
export const AXIS_COLORS: Record<string, string> = {
	vo2max: '#22c55e',
	endurance: '#3b82f6',
	hillStr: '#a855f7',
	hillEnd: '#06b6d4',
	hill: '#a855f7',
	productivity: '#ec4899',
};

// --- Normalization functions ---

/**
 * Cooper Institute VO2max thresholds by age bucket and sex.
 * Values are [Fair, Good, Excellent, Superior] in mL/kg/min
 * (40th · 60th · 80th · 95th percentile).
 * Source: Garmin Owner's Manual — VO2 Max Standard Ratings.
 */
const VO2MAX_COOPER_FULL: Record<'male' | 'female', Record<string, [number, number, number, number]>> = {
	male: {
		'20-29': [41.7, 45.4, 51.1, 55.4],
		'30-39': [40.5, 44.0, 48.3, 54.0],
		'40-49': [38.5, 42.4, 46.4, 52.5],
		'50-59': [35.6, 39.2, 43.4, 48.9],
		'60-69': [32.3, 35.5, 39.5, 45.7],
		'70-79': [29.4, 32.3, 36.7, 42.1],
	},
	female: {
		'20-29': [36.1, 39.5, 43.9, 49.6],
		'30-39': [34.4, 37.8, 42.4, 47.4],
		'40-49': [33.0, 36.3, 39.7, 45.3],
		'50-59': [30.1, 33.0, 36.7, 41.1],
		'60-69': [27.5, 30.0, 33.0, 37.8],
		'70-79': [25.9, 28.1, 30.9, 36.7],
	},
};

/**
 * Padding used to extend the Cooper Fair/Superior bounds to match the Garmin
 * gauge axis (sampled from Garmin Connect for 30-39 male: 28.5 → 62).
 */
const VO2MAX_PAD_BELOW_FAIR = 12;
const VO2MAX_PAD_ABOVE_SUPERIOR = 8;

/**
 * Garmin endurance score zones by age bucket and sex.
 * Entries are ordered oldest-first; the [maxAge, intermediateStart, eliteStart] tuples
 * mean: "up to this age, the Intermediate zone starts at X and the Elite zone starts at Y".
 * Below Intermediate = Recreational (untrained).  ≥ Elite = top zone.
 * Source: Garmin Owner's Manual — Endurance Score Details.
 */
const ENDURANCE_ZONES: Record<'male' | 'female', Array<[number, number, number]>> = {
	male: [
		[20, 5000, 8300],
		[39, 5100, 8800],
		[44, 5100, 8600],
		[49, 5000, 8400],
		[54, 4900, 8000],
		[59, 4600, 7300],
		[64, 4300, 6700],
		[69, 4100, 6200],
		[74, 3800, 5700],
		[80, 3600, 5300],
		[Infinity, 3300, 5000],
	],
	female: [
		[20, 4600, 6900],
		[39, 4700, 7300],
		[44, 4700, 7200],
		[49, 4600, 7100],
		[54, 4500, 6800],
		[59, 4300, 6400],
		[64, 4100, 6100],
		[69, 3800, 5700],
		[74, 3700, 5500],
		[80, 3500, 5200],
		[Infinity, 3200, 4700],
	],
};

function ageBucket(age: number): string {
	if (age < 30) return '20-29';
	if (age < 40) return '30-39';
	if (age < 50) return '40-49';
	if (age < 60) return '50-59';
	if (age < 70) return '60-69';
	return '70-79';
}

/** Age from YYYY-MM-DD birthdate (fallback 35 if unparseable). */
export function computeAge(birthDate: string | null | undefined): number {
	if (!birthDate) return PROFILE_AGE;
	const m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return PROFILE_AGE;
	const now = new Date();
	const y = +m[1], mo = +m[2], d = +m[3];
	let age = now.getFullYear() - y;
	if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
	return age;
}

/** Full Cooper thresholds [Fair, Good, Excellent, Superior] for a given age and sex. */
export function vo2maxCooperFull(age: number, sex: 'male' | 'female'): [number, number, number, number] {
	return VO2MAX_COOPER_FULL[sex]?.[ageBucket(age)] ?? [AXES.vo2max.floor, AXES.vo2max.floor, AXES.vo2max.floor, AXES.vo2max.ceil];
}

/** Cooper Fair/Superior thresholds for a given age and sex. */
export function vo2maxCooper(age: number, sex: 'male' | 'female'): [number, number] {
	const [fair, , , superior] = vo2maxCooperFull(age, sex);
	return [fair, superior];
}

/** Garmin-gauge [floor, ceil] for VO2max (Cooper Fair/Superior + fixed pad). */
export function vo2maxRange(age: number, sex: 'male' | 'female'): [number, number] {
	const [fair, superior] = vo2maxCooper(age, sex);
	return [fair - VO2MAX_PAD_BELOW_FAIR, superior + VO2MAX_PAD_ABOVE_SUPERIOR];
}

/** Garmin endurance Intermediate/Elite thresholds for a given age and sex. */
export function enduranceZones(age: number, sex: 'male' | 'female'): [number, number] {
	const table = ENDURANCE_ZONES[sex];
	for (const [maxAge, intermediate, elite] of table) {
		if (age <= maxAge) return [intermediate, elite];
	}
	const last = table[table.length - 1];
	return [last[1], last[2]];
}

/** [floor, ceil] for endurance: Intermediate-start → Elite-start for this user. */
export function enduranceRange(age: number, sex: 'male' | 'female'): [number, number] {
	return enduranceZones(age, sex);
}

// ---- Zone palettes (Garmin gauge colors) ----------------------------------

export interface Zone {
	min: number;      // raw-value lower bound (inclusive)
	max: number;      // raw-value upper bound (exclusive, except last zone)
	color: string;    // zone fill color
	name: string;     // display name
}

// VO2max (5 zones) — colors sampled from Garmin Connect VO2max gauge SVG
const VO2MAX_ZONE_COLORS = ['#F85454', '#FD9D39', '#40C35D', '#1976D2', '#6F42F3'];
const VO2MAX_ZONE_NAMES = ['Poor', 'Fair', 'Good', 'Excellent', 'Superior'];

/** VO2max zones for this age/sex, spanning [gauge floor, gauge ceil]. */
export function vo2maxZoneBreakdown(age: number, sex: 'male' | 'female'): Zone[] {
	const [fair, good, excellent, superior] = vo2maxCooperFull(age, sex);
	const [floor, ceil] = vo2maxRange(age, sex);
	const boundaries = [floor, fair, good, excellent, superior, ceil];
	return boundaries.slice(0, -1).map((min, i) => ({
		min,
		max: boundaries[i + 1],
		color: VO2MAX_ZONE_COLORS[i],
		name: VO2MAX_ZONE_NAMES[i],
	}));
}

// Endurance (7 zones) — colors from Garmin Connect endurance-score gauge SVG
const ENDURANCE_ZONE_COLORS = ['#E02C2C', '#F27716', '#FD9D39', '#40C35D', '#3B97F3', '#6F42F3', '#E55ECB'];
const ENDURANCE_ZONE_NAMES = ['Recreational', 'Intermediate', 'Trained', 'Well-trained', 'Expert', 'Superior', 'Elite'];

/**
 * Per age bucket: ordered thresholds for
 * [Intermediate, Trained, Well-trained, Expert, Superior, Elite].
 * Source: Garmin Owner's Manual — Endurance Score Details.
 */
const ENDURANCE_THRESHOLDS: Record<'male' | 'female', Array<[number, [number, number, number, number, number, number]]>> = {
	male: [
		[20, [5000, 5700, 6300, 7000, 7600, 8300]],
		[39, [5100, 5800, 6600, 7300, 8100, 8800]],
		[44, [5100, 5800, 6500, 7200, 7900, 8600]],
		[49, [5000, 5700, 6400, 7000, 7700, 8400]],
		[54, [4900, 5500, 6100, 6800, 7400, 8000]],
		[59, [4600, 5100, 5700, 6200, 6800, 7300]],
		[64, [4300, 4800, 5300, 5700, 6200, 6700]],
		[69, [4100, 4500, 4900, 5400, 5800, 6200]],
		[74, [3800, 4200, 4600, 4900, 5300, 5700]],
		[80, [3600, 3900, 4300, 4600, 5000, 5300]],
		[Infinity, [3300, 3600, 4000, 4300, 4700, 5000]],
	],
	female: [
		[20, [4600, 5100, 5500, 6000, 6400, 6900]],
		[39, [4700, 5200, 5700, 6300, 6800, 7300]],
		[44, [4700, 5200, 5700, 6200, 6700, 7200]],
		[49, [4600, 5100, 5600, 6100, 6600, 7100]],
		[54, [4500, 5000, 5400, 5900, 6300, 6800]],
		[59, [4300, 4700, 5100, 5600, 6000, 6400]],
		[64, [4100, 4500, 4900, 5300, 5700, 6100]],
		[69, [3800, 4200, 4600, 4900, 5300, 5700]],
		[74, [3700, 4100, 4400, 4800, 5100, 5500]],
		[80, [3500, 3800, 4200, 4500, 4900, 5200]],
		[Infinity, [3200, 3500, 3800, 4100, 4400, 4700]],
	],
};

function enduranceThresholds(age: number, sex: 'male' | 'female'): [number, number, number, number, number, number] {
	for (const [maxAge, thresholds] of ENDURANCE_THRESHOLDS[sex]) {
		if (age <= maxAge) return thresholds;
	}
	return ENDURANCE_THRESHOLDS[sex][ENDURANCE_THRESHOLDS[sex].length - 1][1];
}

/**
 * Endurance zones for this age/sex. Garmin's gauge doesn't publish a hard min/max
 * (Recreational is "< X" and Elite is "X+"), so we synthesize the outer bounds by
 * padding one adjacent tier-width on each side.
 */
export function enduranceZoneBreakdown(age: number, sex: 'male' | 'female'): Zone[] {
	const th = enduranceThresholds(age, sex);  // [Intermediate, Trained, Well-trained, Expert, Superior, Elite]
	const intermediateWidth = th[1] - th[0];
	const eliteWidth = th[5] - th[4];
	const recreationalMin = Math.max(0, th[0] - intermediateWidth);
	const eliteMax = th[5] + eliteWidth;
	const boundaries = [recreationalMin, th[0], th[1], th[2], th[3], th[4], th[5], eliteMax];
	return boundaries.slice(0, -1).map((min, i) => ({
		min,
		max: boundaries[i + 1],
		color: ENDURANCE_ZONE_COLORS[i],
		name: ENDURANCE_ZONE_NAMES[i],
	}));
}

/**
 * Hill sub-scores (Str / End) use a simple 3-tier orange/yellow/green palette
 * to color their displayed values. Not used for progress bars — just color lookup.
 */
const HILL_SUB_ZONES: Zone[] = [
	{ min: 0,  max: 34,  color: '#fb923c', name: 'Beginner' },
	{ min: 34, max: 67,  color: '#eab308', name: 'Intermediate' },
	{ min: 67, max: 101, color: '#22c55e', name: 'Advanced' },
];

export function hillSubZones(): Zone[] {
	return HILL_SUB_ZONES;
}

/** Color for a hill sub-score (End / Str) based on the 3-tier palette. */
export function hillSubColor(score: number): string {
	return HILL_SUB_ZONES.find(z => score >= z.min && score < z.max)?.color ?? HILL_SUB_ZONES[HILL_SUB_ZONES.length - 1].color;
}

// Hill overall (6 zones) — using Garmin endurance palette (hill gauge uses same spectrum)
const HILL_ZONE_COLORS = ['#E02C2C', '#FD9D39', '#40C35D', '#3B97F3', '#6F42F3', '#E55ECB'];
const HILL_ZONE_NAMES = ['Recreational', 'Challenger', 'Trained', 'Skilled', 'Expert', 'Elite'];
const HILL_ZONE_BOUNDS = [0, 25, 50, 70, 85, 95, 101];

export function hillZoneBreakdown(): Zone[] {
	return HILL_ZONE_COLORS.map((color, i) => ({
		min: HILL_ZONE_BOUNDS[i],
		max: HILL_ZONE_BOUNDS[i + 1],
		color,
		name: HILL_ZONE_NAMES[i],
	}));
}

/**
 * Productivity zones — dashboard-local metric (not from Garmin).
 * 4 tiers over a 0–100 weighted training-quality score.
 */
const PRODUCTIVITY_ZONES: Zone[] = [
	{ min: 0,  max: 50,  color: '#E02C2C', name: 'Poor' },
	{ min: 50, max: 70,  color: '#FD9D39', name: 'Fair' },
	{ min: 70, max: 90,  color: '#40C35D', name: 'Good' },
	{ min: 90, max: 101, color: '#3B97F3', name: 'Excellent' },
];

export function productivityZoneBreakdown(): Zone[] {
	return PRODUCTIVITY_ZONES;
}

// ---- Trend series (raw values over time) ----------------------------------

import type { DailyTrainingStatus as DTS, HillScore as HS, EnduranceScore as ES } from './types.js';
import { weekMonday, utcDate } from './dates.js';

export interface TrendSeries {
	labels: string[];
	vo2max: (number | null)[];
	endurance: (number | null)[];
	hillStr: (number | null)[];
	hillEnd: (number | null)[];
}

function _endOfWeek<T extends { date: string }>(items: T[]): Map<string, T> {
	const asc = [...items].filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date));
	const byWeek = new Map<string, T>();
	for (const e of asc) byWeek.set(weekMonday(e.date), e);
	return byWeek;
}

function _fmtLabel(dateStr: string): string {
	// Match ProjectionChart's "DD/MM" format
	return dateStr.slice(5).split('-').reverse().join('/');
}

/** Build time-bucketed series of raw values for the Profile Trend charts. */
export function computeTrendSeries(
	statusHistory: DTS[],
	hillScoreHistory: HS[],
	enduranceScoreHistory: ES[],
	granularity: 'day' | 'week' = 'day',
): TrendSeries {
	if (granularity === 'week') {
		const weekStatus = _endOfWeek(statusHistory);
		const weekHill = _endOfWeek(hillScoreHistory);
		const weekEndur = _endOfWeek(enduranceScoreHistory);
		const weeks = [...new Set<string>([...weekStatus.keys(), ...weekHill.keys(), ...weekEndur.keys()])].sort();
		return {
			labels: weeks.map(_fmtLabel),
			vo2max: weeks.map(w => weekStatus.get(w)?.vo2max ?? null),
			endurance: weeks.map(w => weekEndur.get(w)?.score ?? null),
			hillStr: weeks.map(w => weekHill.get(w)?.strength_score ?? null),
			hillEnd: weeks.map(w => weekHill.get(w)?.endurance_score ?? null),
		};
	}

	const hillByDate = new Map<string, HS>();
	for (const h of hillScoreHistory) if (h.date) hillByDate.set(h.date, h);
	const endurByDate = new Map<string, ES>();
	for (const e of enduranceScoreHistory) if (e.date) endurByDate.set(e.date, e);

	const days = [...statusHistory].filter(s => s.date).sort((a, b) => a.date.localeCompare(b.date));
	return {
		labels: days.map(s => _fmtLabel(s.date)),
		vo2max: days.map(s => s.vo2max ?? null),
		endurance: days.map(s => endurByDate.get(s.date)?.score ?? null),
		hillStr: days.map(s => hillByDate.get(s.date)?.strength_score ?? null),
		hillEnd: days.map(s => hillByDate.get(s.date)?.endurance_score ?? null),
	};
}

/** Zones for a given axis in the current user context, or null if the axis has no zones. */
export function axisZones(axisKey: string, ctx?: ProfileCtx): Zone[] | null {
	if (axisKey === 'vo2max' && ctx) return vo2maxZoneBreakdown(ctx.age, ctx.sex);
	if (axisKey === 'endurance' && ctx) return enduranceZoneBreakdown(ctx.age, ctx.sex);
	if (axisKey === 'hill') return hillZoneBreakdown();
	if (axisKey === 'productivity') return productivityZoneBreakdown();
	return null;
}

export interface ProfileCtx {
	age: number;
	sex: 'male' | 'female';
}

/** Dynamic [floor, ceil] for an axis given the user context. */
export function axisBounds(axisKey: string, ctx?: ProfileCtx): [number, number] {
	if (ctx) {
		if (axisKey === 'vo2max') return vo2maxRange(ctx.age, ctx.sex);
		if (axisKey === 'endurance') return enduranceRange(ctx.age, ctx.sex);
	}
	const a = AXES[axisKey];
	return a ? [a.floor, a.ceil] : [0, 100];
}

/** Normalize a raw value to 0–100 using the axis definition (or ctx override). */
export function normalize(axisKey: string, rawValue: number, ctx?: ProfileCtx): number {
	const [floor, ceil] = axisBounds(axisKey, ctx);
	if (ceil === floor) return 0;
	return Math.max(0, Math.min(100, Math.round(((rawValue - floor) / (ceil - floor)) * 100)));
}

/** Format a raw value for display (with unit if applicable) */
export function formatRaw(axisKey: string, rawValue: number): string {
	const axis = AXES[axisKey];
	if (!axis) return String(rawValue);
	switch (axisKey) {
		case 'vo2max': return rawValue.toFixed(1);
		case 'endurance': return rawValue.toLocaleString();
		case 'productivity': return Math.round(rawValue) + '%';
		case 'hillStr':
		case 'hillEnd':
		case 'hill': return String(Math.round(rawValue));
		default: return String(rawValue);
	}
}

/** Format a raw delta value for display (with sign; always shows + for 0) */
export function formatRawDelta(axisKey: string, delta: number): string {
	const sign = delta < 0 ? '' : '+';
	switch (axisKey) {
		case 'vo2max': return sign + delta.toFixed(1);
		case 'endurance': return sign + Math.round(delta).toLocaleString();
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
	const w = history.filter(s => s.date >= cutoff && s.date <= endDate && s.status);
	if (w.length === 0) return -1;
	const total = w.reduce((sum, s) => {
		const base = s.status.replace(/_\d+$/, '');
		return sum + (STATUS_WEIGHT[base] ?? 0);
	}, 0);
	return Math.round((total / w.length) * 100);
}

