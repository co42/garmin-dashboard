/**
 * Deconvolution of Garmin's 28-day rolling training load into daily contributions.
 *
 * Solves: min ||A·x - y||²  subject to x >= 0
 *
 * where y = rolling 28-day sums, A = banded Toeplitz matrix (28 ones per row),
 * x = unknown daily contributions. Uses ISTA (Iterative Shrinkage-Thresholding)
 * with non-negativity projection. Activity dates provide a sparsity mask
 * (rest days are forced to 0), making the system well over-determined.
 */

import type { DailyTrainingStatus } from './types.js';
import { addDays, daysBetween } from './dates.js';

const WINDOW = 28;

export interface LoadSegments {
	/** Most recent 7 days [D-6..D] */
	recent: number;
	/** Middle 14 days [D-20..D-7] */
	middle: number;
	/** Oldest 7 days [D-27..D-21] — about to expire */
	expiring: number;
}

type LoadExtractor = (s: DailyTrainingStatus) => number;

/**
 * Deconvolve a 28-day rolling sum into per-day contributions using NNLS.
 *
 * @param history - Full status history, sorted ASC by date
 * @param extract - Function to extract the rolling sum value from a status entry
 * @param activityDays - Map from date string to total activity_training_load on that day
 * @returns Map from date string (YYYY-MM-DD) to daily contribution
 */
export function deconvolveDailyLoad(
	history: DailyTrainingStatus[],
	extract: LoadExtractor,
	activityDays: Map<string, number>,
): Map<string, number> {
	// Filter to entries with valid numeric values for this channel
	const valid = history.filter(s => {
		const v = extract(s);
		return v != null && !isNaN(v);
	});
	if (valid.length === 0) return new Map();

	// Build date -> rolling sum, filling gaps with interpolation
	const knownDates = valid.map(s => s.date.slice(0, 10));
	const knownRolling = new Map<string, number>();
	for (const s of valid) knownRolling.set(s.date.slice(0, 10), extract(s));

	const obsDates: string[] = [];
	const obsValues: number[] = [];

	for (let i = 0; i < knownDates.length; i++) {
		if (i === 0) {
			obsDates.push(knownDates[0]);
			obsValues.push(knownRolling.get(knownDates[0])!);
			continue;
		}
		const gap = daysBetween(knownDates[i - 1], knownDates[i]);
		const prevVal = knownRolling.get(knownDates[i - 1])!;
		const curVal = knownRolling.get(knownDates[i])!;
		for (let g = 1; g < gap; g++) {
			obsDates.push(addDays(knownDates[i - 1], g));
			obsValues.push(prevVal + (curVal - prevVal) * (g / gap));
		}
		obsDates.push(knownDates[i]);
		obsValues.push(curVal);
	}

	const N = obsDates.length; // number of observations
	if (N === 0) return new Map();

	// The contribution window spans from (firstObsDate - 27) to lastObsDate
	const firstObsDate = obsDates[0];
	const firstContribDate = addDays(firstObsDate, -(WINDOW - 1));
	const lastContribDate = obsDates[N - 1];
	const M = daysBetween(firstContribDate, lastContribDate) + 1; // total contribution days

	// Build date list for contributions and activity mask
	const contribDates: string[] = [];
	const isActivity: boolean[] = [];
	for (let j = 0; j < M; j++) {
		const d = addDays(firstContribDate, j);
		contribDates.push(d);
		isActivity.push(activityDays.has(d));
	}

	// Active columns: indices of days that had activities
	const activeCols: number[] = [];
	for (let j = 0; j < M; j++) {
		if (isActivity[j]) activeCols.push(j);
	}

	const K = activeCols.length; // number of unknowns
	if (K === 0) return new Map();

	// ISTA solver for reduced system: A_reduced * x_reduced = y
	// A[i][k] = 1 if activeCols[k] is in [i, i+27] relative to contribution indexing
	// observation i corresponds to rolling sum for obsDates[i],
	// which sums contributions from contribDate index i to i+27

	// Compute A·x (using running sum for efficiency)
	function applyA(x: Float64Array): Float64Array {
		// Full contribution vector (sparse: only active cols nonzero)
		const full = new Float64Array(M);
		for (let k = 0; k < K; k++) full[activeCols[k]] = x[k];

		// Prefix sum
		const prefix = new Float64Array(M + 1);
		for (let j = 0; j < M; j++) prefix[j + 1] = prefix[j] + full[j];

		// Each observation i sums contributions [i, i+27]
		const result = new Float64Array(N);
		for (let i = 0; i < N; i++) {
			const lo = i; // contribution index = obs index (since firstContribDate + i + 27 = firstObsDate + i maps correctly... let me verify)
			// Actually: obs i = rolling sum for obsDates[i] = sum of contribs for [obsDates[i]-27, obsDates[i]]
			// obsDates[i] = firstObsDate + i (assuming no gaps, which we filled)
			// In contribution index: obsDates[i] = firstContribDate + (WINDOW-1) + i = contribDates[WINDOW-1+i]
			// So the sum covers contribDates[i] to contribDates[i+WINDOW-1]
			result[i] = prefix[i + WINDOW] - prefix[i];
		}
		return result;
	}

	// Compute A^T · r (reduced to active cols)
	function applyAT(r: Float64Array): Float64Array {
		// A^T[k][i] = 1 if activeCols[k] in [i, i+27]
		// So A^T·r at col j = sum of r[i] for all i where j in [i, i+27], i.e. i in [j-27, j] ∩ [0, N-1]
		// Using prefix sum of r
		const prefixR = new Float64Array(N + 1);
		for (let i = 0; i < N; i++) prefixR[i + 1] = prefixR[i] + r[i];

		const result = new Float64Array(K);
		for (let k = 0; k < K; k++) {
			const j = activeCols[k];
			const lo = Math.max(0, j - WINDOW + 1);
			const hi = Math.min(N - 1, j);
			if (hi >= lo) {
				result[k] = prefixR[hi + 1] - prefixR[lo];
			}
		}
		return result;
	}

	// Step size: 1/L where L = largest eigenvalue of A^T·A ≈ WINDOW^2 for our banded matrix
	// But with reduced cols, L ≤ WINDOW * max_overlap. Use conservative estimate.
	// Lipschitz constant for banded Toeplitz: max column overlap = WINDOW
	// With reduced cols, effective L ≈ WINDOW. Use slightly aggressive step.
	const stepSize = 1.8 / (WINDOW * WINDOW);

	// Target vector
	const y = new Float64Array(obsValues);

	// Initialize x with activity loads as hints (scaled down since each channel is a fraction)
	const x = new Float64Array(K);
	for (let k = 0; k < K; k++) {
		const load = activityDays.get(contribDates[activeCols[k]]) ?? 0;
		x[k] = load / 3; // rough initial guess: 1/3 of total goes to each channel
	}

	// ISTA iterations
	for (let iter = 0; iter < 2000; iter++) {
		const Ax = applyA(x);
		const residual = new Float64Array(N);
		for (let i = 0; i < N; i++) residual[i] = Ax[i] - y[i];

		const grad = applyAT(residual);

		for (let k = 0; k < K; k++) {
			x[k] = Math.max(0, x[k] - stepSize * grad[k]);
		}
	}

	// Build result map
	const contributions = new Map<string, number>();
	for (let j = 0; j < M; j++) {
		contributions.set(contribDates[j], 0);
	}
	for (let k = 0; k < K; k++) {
		contributions.set(contribDates[activeCols[k]], x[k]);
	}

	return contributions;
}

/**
 * Split daily contributions into 3 segments for a target date,
 * with proportional correction to match the known rolling total exactly.
 */
export function segmentLoad(
	contributions: Map<string, number>,
	targetDate: string,
	totalRolling: number,
): LoadSegments {
	let recent = 0;   // [D-6, D]
	let middle = 0;   // [D-20, D-7]
	let expiring = 0; // [D-27, D-21]

	for (let i = 0; i < WINDOW; i++) {
		const d = addDays(targetDate, -i);
		const c = Math.max(0, contributions.get(d) ?? 0);
		if (i <= 6) recent += c;
		else if (i <= 20) middle += c;
		else expiring += c;
	}

	// Proportional correction for final exactness
	const rawTotal = recent + middle + expiring;
	if (rawTotal > 0 && totalRolling > 0) {
		const ratio = totalRolling / rawTotal;
		recent *= ratio;
		middle *= ratio;
		expiring *= ratio;
	} else {
		return { recent: 0, middle: 0, expiring: 0 };
	}

	return { recent, middle, expiring };
}
