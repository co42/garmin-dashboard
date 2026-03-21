import type { DashboardData } from './types.js';

export interface Advice {
	runType: string;
	description: string;
	rationale: string;
	intensity: 'easy' | 'moderate' | 'hard' | 'rest';
	distanceKm?: string;
	paceGuidance?: string;
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
	const { readiness, trainingStatus, daysSinceLastRun } = data;
	const acwr = trainingStatus.status.acuteTrainingLoadDTO.dailyAcuteChronicWorkloadRatio;
	const acwrStatus = trainingStatus.status.acuteTrainingLoadDTO.acwrStatus;
	const statusPhrase = trainingStatus.status.trainingStatusFeedbackPhrase;
	const score = readiness.score;
	const balance = trainingStatus.loadBalance;

	// Rest day if readiness is very low
	if (score < 30) {
		return {
			runType: 'Rest Day',
			description: 'Skip today — recovery is the priority.',
			rationale: `Readiness score is ${score}. Your body needs recovery before the next load.`,
			intensity: 'rest',
		};
	}

	// If overreaching, back off
	if (statusPhrase === 'OVERREACHING') {
		return {
			runType: 'Easy Recovery',
			description: 'Very easy jog or walk. Keep HR below Z2.',
			rationale: 'Training status is overreaching — reduce load to avoid injury.',
			intensity: 'easy',
			distanceKm: '4-5',
			paceGuidance: 'Conversational pace',
		};
	}

	// If detraining with low ACWR, need to rebuild
	if (statusPhrase === 'DETRAINING' || acwrStatus === 'LOW') {
		const daysSince = daysSinceLastRun ?? 0;

		if (daysSince > 7) {
			return {
				runType: 'Easy Comeback Run',
				description: 'Gentle return to running. Short and slow.',
				rationale: `${daysSince} days since last run, ACWR at ${acwr}. Start small to rebuild consistency.`,
				intensity: 'easy',
				distanceKm: '4-6',
				paceGuidance: 'Easy pace, keep HR in Z2',
			};
		}

		// Aero low deficit — prioritize easy volume
		if (balance.monthlyLoadAerobicLow < balance.monthlyLoadAerobicLowTargetMin) {
			return {
				runType: 'Aerobic Base Run',
				description: 'Build aerobic low load with steady easy mileage.',
				rationale: `Aero low is ${Math.round(balance.monthlyLoadAerobicLow)} vs target ${balance.monthlyLoadAerobicLowTargetMin}-${balance.monthlyLoadAerobicLowTargetMax}. Easy volume needed.`,
				intensity: 'easy',
				distanceKm: '8-10',
				paceGuidance: 'Z2, easy conversational',
			};
		}

		// Aero high surplus but still detraining — maintain with moderate effort
		if (balance.monthlyLoadAerobicHigh > balance.monthlyLoadAerobicHighTargetMax) {
			return {
				runType: 'Easy Run',
				description: 'Keep it easy — aero high load is already above target.',
				rationale: `Aero high at ${Math.round(balance.monthlyLoadAerobicHigh)} exceeds target max ${balance.monthlyLoadAerobicHighTargetMax}. Focus on easy volume instead.`,
				intensity: 'easy',
				distanceKm: '6-8',
				paceGuidance: 'Easy pace only',
			};
		}

		return {
			runType: 'Moderate Run',
			description: 'Steady effort to rebuild training load.',
			rationale: `ACWR at ${acwr} — need to bring acute load back up gradually.`,
			intensity: 'moderate',
			distanceKm: '8-10',
			paceGuidance: 'Mid-Z2 to low-Z3',
		};
	}

	// Productive / maintaining — check readiness to calibrate intensity
	if (score >= 80 && acwr < 1.3) {
		// High readiness, room in ACWR — can push
		if (balance.monthlyLoadAnaerobic < balance.monthlyLoadAnaerobicTargetMin) {
			return {
				runType: 'Tempo / Intervals',
				description: 'Push the anaerobic load — intervals or tempo work.',
				rationale: `Readiness ${score}, ACWR ${acwr}. Anaerobic load at ${Math.round(balance.monthlyLoadAnaerobic)} is below target ${balance.monthlyLoadAnaerobicTargetMin}.`,
				intensity: 'hard',
				distanceKm: '8-12',
				paceGuidance: 'Warm up, then Z4 intervals or sustained Z3-Z4',
			};
		}

		return {
			runType: 'Steady Run',
			description: 'Good day for a solid aerobic effort.',
			rationale: `Readiness ${score}, good load balance. Maintain the trajectory.`,
			intensity: 'moderate',
			distanceKm: '8-12',
			paceGuidance: 'Z2-Z3, moderate effort',
		};
	}

	// Moderate readiness — easy to moderate
	if (score >= 50) {
		return {
			runType: 'Easy Run',
			description: 'Keep it aerobic. Recover while building base.',
			rationale: `Readiness ${score} — moderate. Easy effort is the best return on investment today.`,
			intensity: 'easy',
			distanceKm: '6-8',
			paceGuidance: 'Z2, conversational',
		};
	}

	// Low-ish readiness
	return {
		runType: 'Recovery Jog',
		description: 'Very short, very easy. Or take the day off.',
		rationale: `Readiness ${score} is low. Light movement only if you feel up to it.`,
		intensity: 'easy',
		distanceKm: '3-5',
		paceGuidance: 'Slowest comfortable pace',
	};
}
