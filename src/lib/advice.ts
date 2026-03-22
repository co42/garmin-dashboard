import type { DashboardData } from './types.js';

export interface Advice {
	runType: string;
	description: string;
	rationale: string;
	intensity: 'easy' | 'moderate' | 'hard' | 'rest';
	distanceKm?: string;
	paceGuidance?: string;
	workout?: string;
}

const INTENSITY_COLORS: Record<Advice['intensity'], string> = {
	easy: '#22c55e',
	moderate: '#f59e0b',
	hard: '#ef4444',
	rest: '#14b8a6',
};

export function getIntensityColor(intensity: Advice['intensity']): string {
	return INTENSITY_COLORS[intensity];
}

export function generateAdvice(data: DashboardData): Advice {
	const { readiness, currentStatus: s, daysSinceLastRun, bodyBattery, sleepScoreHistory, hillScore } = data;
	const acwr = s.acwr;
	const score = readiness.score;
	const bb = bodyBattery.latest;

	// Aggregate HR zone time from last 10 activities
	const recentActivities = data.activities.slice(0, 10);
	const totalZ4Z5 = recentActivities.reduce((sum, a) =>
		sum + (a.hr_time_in_zone_4 ?? 0) + (a.hr_time_in_zone_5 ?? 0), 0);
	const totalZoneTime = recentActivities.reduce((sum, a) =>
		sum + (a.hr_time_in_zone_1 ?? 0) + (a.hr_time_in_zone_2 ?? 0) +
		(a.hr_time_in_zone_3 ?? 0) + (a.hr_time_in_zone_4 ?? 0) + (a.hr_time_in_zone_5 ?? 0), 0);
	const z4z5Pct = totalZoneTime > 0 ? totalZ4Z5 / totalZoneTime : 0;
	const hasNoHighIntensity = z4z5Pct < 0.05 && recentActivities.length >= 3;

	// Recent sleep quality
	const recentSleep = sleepScoreHistory.slice(-3);
	const avgSleep = recentSleep.length > 0
		? recentSleep.reduce((sum, s) => sum + s.score, 0) / recentSleep.length
		: 80;
	const poorSleepStreak = avgSleep < 60;

	// Body battery override
	if (bb > 0 && bb < 25) {
		return {
			runType: 'Rest Day',
			description: 'Body battery is critically low. Recovery first.',
			rationale: `Body battery at ${bb}. Sleep and recovery should be the only priority today.`,
			intensity: 'rest',
		};
	}

	// Poor sleep override
	if (poorSleepStreak && score < 60) {
		return {
			runType: 'Rest or Easy Walk',
			description: 'Multiple nights of poor sleep. Prioritize recovery.',
			rationale: `Average sleep score ${Math.round(avgSleep)} over the last 3 nights with readiness ${score}. Rest is more valuable than training right now.`,
			intensity: 'rest',
		};
	}

	// Very low readiness
	if (score < 30) {
		return {
			runType: 'Rest Day',
			description: 'Skip today — recovery is the priority.',
			rationale: `Readiness score is ${score}. Your body needs recovery before the next load.`,
			intensity: 'rest',
		};
	}

	// Overreaching
	if (s.status.includes('OVERREACHING')) {
		return {
			runType: 'Easy Recovery',
			description: 'Very easy jog or walk. Keep HR below Z2.',
			rationale: 'Training status is overreaching — reduce load to avoid injury.',
			intensity: 'easy',
			distanceKm: '4-5',
			paceGuidance: 'Conversational pace',
		};
	}

	// Detraining / low ACWR — need to rebuild
	if (s.status.includes('DETRAINING') || s.acwr_status === 'LOW') {
		const days = daysSinceLastRun ?? 0;

		if (days > 7) {
			return {
				runType: 'Easy Comeback Run',
				description: 'Gentle return to running. Short and slow.',
				rationale: `${days} days since last run, ACWR at ${acwr}. Start small to rebuild consistency.`,
				intensity: 'easy',
				distanceKm: '4-6',
				paceGuidance: 'Easy pace, stay in Z2',
			};
		}

		// Check load balance gaps
		if (s.monthly_load_aerobic_low < s.monthly_load_aerobic_low_target_min) {
			return {
				runType: 'Aerobic Base Run',
				description: 'Build your aerobic low load with steady easy mileage.',
				rationale: `Aero low at ${Math.round(s.monthly_load_aerobic_low)} vs target ${s.monthly_load_aerobic_low_target_min}+. Easy volume needed.`,
				intensity: 'easy',
				distanceKm: '8-10',
				paceGuidance: 'Z2, conversational',
			};
		}

		if (s.monthly_load_aerobic_high > s.monthly_load_aerobic_high_target_max) {
			return {
				runType: 'Easy Run',
				description: 'Aero high is above target — keep it easy to balance load.',
				rationale: `Aero high at ${Math.round(s.monthly_load_aerobic_high)} exceeds max ${s.monthly_load_aerobic_high_target_max}. Focus on easy volume.`,
				intensity: 'easy',
				distanceKm: '6-8',
				paceGuidance: 'Easy pace only',
			};
		}

		return {
			runType: 'Moderate Run',
			description: 'Steady effort to rebuild training load.',
			rationale: `ACWR at ${acwr} — bring acute load back up gradually.`,
			intensity: 'moderate',
			distanceKm: '8-10',
			paceGuidance: 'Mid-Z2 to low-Z3',
		};
	}

	// Productive / maintaining with high readiness — push
	if (score >= 80 && acwr < 1.3) {
		// No high intensity in weeks? Prioritize that
		if (hasNoHighIntensity) {
			return {
				runType: 'Interval Session',
				description: `You haven't done Z4+ work recently. Time to add intensity.`,
				rationale: `Only ${Math.round(z4z5Pct * 100)}% of recent training time in Z4-Z5. Anaerobic load at ${Math.round(s.monthly_load_anaerobic)} vs target ${s.monthly_load_anaerobic_target_min}+.`,
				intensity: 'hard',
				distanceKm: '8-10',
				paceGuidance: 'Z4 intervals',
				workout: '6×800m @ 3:50-3:55 /km, 90s jog recovery. 2km warm-up, 1km cool-down.',
			};
		}

		// Weak hills?
		if (hillScore.overall > 0 && hillScore.endurance < 30) {
			return {
				runType: 'Hill Endurance Run',
				description: 'Your hill endurance is a limiter. Run a hilly route today.',
				rationale: `Hill endurance score ${hillScore.endurance}/100. Steady effort on rolling terrain builds this.`,
				intensity: 'moderate',
				distanceKm: '10-12',
				paceGuidance: 'Even effort (not even pace) on hills',
			};
		}

		// Anaerobic deficit
		if (s.monthly_load_anaerobic < s.monthly_load_anaerobic_target_min) {
			return {
				runType: 'Tempo Run',
				description: 'Push the anaerobic load with sustained tempo effort.',
				rationale: `Readiness ${score}, ACWR ${acwr}. Anaerobic at ${Math.round(s.monthly_load_anaerobic)} below target ${s.monthly_load_anaerobic_target_min}.`,
				intensity: 'hard',
				distanceKm: '8-12',
				paceGuidance: 'Z3-Z4, comfortably hard',
				workout: '2km warm-up, 4×2km @ threshold pace, 1min jog, 1km cool-down.',
			};
		}

		return {
			runType: 'Steady Run',
			description: 'Good day for a solid aerobic effort.',
			rationale: `Readiness ${score}, balanced load. Maintain the trajectory.`,
			intensity: 'moderate',
			distanceKm: '8-12',
			paceGuidance: 'Z2-Z3',
		};
	}

	// Moderate readiness
	if (score >= 50) {
		return {
			runType: 'Easy Run',
			description: 'Keep it aerobic. Recover while building base.',
			rationale: `Readiness ${score}. Easy effort is the best return on investment today.`,
			intensity: 'easy',
			distanceKm: '6-8',
			paceGuidance: 'Z2, conversational',
		};
	}

	return {
		runType: 'Recovery Jog',
		description: 'Very short, very easy. Or take the day off.',
		rationale: `Readiness ${score} is low. Light movement only if you feel up to it.`,
		intensity: 'easy',
		distanceKm: '3-5',
		paceGuidance: 'Slowest comfortable pace',
	};
}
