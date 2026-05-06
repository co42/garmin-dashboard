// Shared workout-step formatting + estimate helpers. Kept framework-free so
// any component can import — UpcomingCard, the new WorkoutSteps component,
// and the workout editor's live preview all use the same logic.

import type { WorkoutStep } from './types.js';

// ── Formatters ──────────────────────────────────────────────────────────────

export function fmtDist(m: number): string {
	return m >= 1000
		? `${m / 1000 % 1 === 0 ? m / 1000 : (m / 1000).toFixed(1)}km`
		: `${Math.round(m)}m`;
}

export function fmtTime(s: number): string {
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function fmtPace(speedMs: number): string {
	const secs = Math.round(1000 / speedMs);
	const m = Math.floor(secs / 60);
	const sec = secs % 60;
	return `${m}:${sec.toString().padStart(2, '0')}/km`;
}

export function fmtDuration(s: number): string {
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

export function fmtExercise(name: string): string {
	return name.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Step labels ─────────────────────────────────────────────────────────────

// Garmin returns numeric instruction codes for `target_type === 'instruction'`.
export const INSTRUCTION_LABELS: Record<number, string> = {
	1: 'easy', 2: 'moderate', 3: 'hard', 4: 'very hard', 5: 'max effort',
	6: 'warm up', 7: 'cool down', 8: 'recovery', 9: 'tempo',
	10: 'steady', 11: 'race pace', 12: 'all out',
};

export const STEP_LABELS: Record<string, string> = {
	warmup: 'Warm Up', cooldown: 'Cool Down', interval: 'Run',
	recovery: 'Recovery', rest: 'Rest',
};

export function stepLabel(key: string): string {
	return STEP_LABELS[key] ?? key;
}

// ── Per-step formatting ─────────────────────────────────────────────────────

export function stepDuration(s: WorkoutStep): string {
	if (s.end_condition === 'distance' && s.end_condition_value) return fmtDist(s.end_condition_value);
	if (s.end_condition === 'time' && s.end_condition_value) return fmtTime(s.end_condition_value);
	if (s.end_condition === 'iterations' && s.end_condition_value) return `${s.end_condition_value} reps`;
	if (s.end_condition === 'lap.button') return 'lap';
	return '';
}

export function stepTarget(s: WorkoutStep): string {
	if (s.target_type === 'pace.zone' && s.target_value_one != null && s.target_value_two != null) {
		const [fast, slow] = s.target_value_one > s.target_value_two
			? [s.target_value_one, s.target_value_two]
			: [s.target_value_two, s.target_value_one];
		return `${fmtPace(fast)}–${fmtPace(slow)}`;
	}
	if (s.target_type === 'heart.rate.zone' && s.target_value_one != null && s.target_value_two != null) {
		const [lo, hi] = s.target_value_one < s.target_value_two
			? [s.target_value_one, s.target_value_two]
			: [s.target_value_two, s.target_value_one];
		return lo === hi ? `${lo} bpm` : `${lo}–${hi} bpm`;
	}
	if (s.target_type === 'instruction' && s.target_value_one != null) {
		return INSTRUCTION_LABELS[s.target_value_one] ?? '';
	}
	if (s.target_type === 'power.zone' && s.target_value_one != null && s.target_value_two != null) {
		const [lo, hi] = s.target_value_one < s.target_value_two
			? [s.target_value_one, s.target_value_two]
			: [s.target_value_two, s.target_value_one];
		return `${Math.round(lo)}–${Math.round(hi)} W`;
	}
	return '';
}

export function stepValues(s: WorkoutStep): string {
	return [stepDuration(s), stepTarget(s)].filter(Boolean).join(' · ');
}

export function stepExerciseName(s: WorkoutStep): string | null {
	return s.exercise_name ? fmtExercise(s.exercise_name) : null;
}

// ── Roll-up over a tree of steps ────────────────────────────────────────────

/// Walks the step tree, summing distance/time and counting leaf steps. Repeat
/// groups multiply their children's contribution by `number_of_iterations`.
export function stepsEstimates(steps: WorkoutStep[]): { dist: number; time: number; count: number } {
	let totalDist = 0;
	let totalTime = 0;
	let stepCount = 0;
	function walk(list: WorkoutStep[], reps: number) {
		for (const s of list) {
			if (s.type === 'RepeatGroupDTO' && s.number_of_iterations && s.steps) {
				walk(s.steps, s.number_of_iterations);
			} else {
				stepCount++;
				if (s.end_condition === 'distance' && s.end_condition_value) totalDist += s.end_condition_value * reps;
				if (s.end_condition === 'time' && s.end_condition_value) totalTime += s.end_condition_value * reps;
			}
		}
	}
	walk(steps, 1);
	return { dist: totalDist, time: totalTime, count: stepCount };
}
