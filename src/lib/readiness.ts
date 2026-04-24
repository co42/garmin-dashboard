import type { Readiness, ReadinessEntry } from './types.js';

export function resolveReadiness(r: Readiness): ReadinessEntry {
	return r.morning ?? r.post_activity ?? r.latest ?? {
		score: 0, level: 'UNKNOWN', feedback_short: '', recovery_time: 0,
		hrv_weekly_average: 0, hrv_factor_percent: 0, hrv_factor_feedback: '',
		sleep_history_factor_percent: 0, sleep_history_factor_feedback: '',
		sleep_score_factor_percent: 0, sleep_score_factor_feedback: '',
		recovery_time_factor_percent: 0, recovery_time_factor_feedback: '',
		acwr_factor_percent: 0, acwr_factor_feedback: '',
		stress_history_factor_percent: 0, stress_history_factor_feedback: '',
	};
}
