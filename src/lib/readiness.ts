import type { Readiness, ReadinessEntry } from './types.js';

export function resolveReadiness(r: Readiness): ReadinessEntry {
	return r.morning ?? r.post_activity ?? {
		score: 0, level: 'UNKNOWN', feedback: '', recovery_time_minutes: 0,
		hrv_weekly_average: 0, hrv_score: 0, hrv_feedback: '',
		sleep_history_score: 0, sleep_history_feedback: '',
		sleep_score: 0, sleep_feedback: '',
		recovery_score: 0, recovery_feedback: '',
		acwr_score: 0, acwr_feedback: '',
		stress_score: 0, stress_feedback: '',
	};
}
