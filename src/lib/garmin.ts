import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
	TrainingStatus,
	Readiness,
	RacePredictions,
	EnduranceScore,
	FitnessAge,
	LactateThreshold,
	HrvDay,
	Activity,
} from './types.js';

const exec = promisify(execFile);

async function garmin<T>(args: string[]): Promise<T> {
	const { stdout } = await exec('garmin', [...args, '--json'], {
		timeout: 15000,
		env: { ...process.env, NO_COLOR: '1' },
	});
	return JSON.parse(stdout) as T;
}

// --- Raw response types ---

interface RawTrainingStatusResponse {
	mostRecentTrainingStatus: {
		latestTrainingStatusData: Record<string, {
			acuteTrainingLoadDTO: TrainingStatus['status']['acuteTrainingLoadDTO'];
			calendarDate: string;
			deviceId: number;
			fitnessTrend: number;
			fitnessTrendSport: string;
			sport: string;
			trainingStatus: number;
			trainingStatusFeedbackPhrase: string;
			trainingPaused: boolean;
		}>;
	};
	mostRecentTrainingLoadBalance: {
		metricsTrainingLoadBalanceDTOMap: Record<string, TrainingStatus['loadBalance']>;
	};
	mostRecentVO2Max: {
		generic: TrainingStatus['vo2max'] | null;
	};
}

interface RawReadinessEntry {
	score: number;
	level: string;
	calendarDate: string;
	hrvFactorPercent: number;
	hrvFactorFeedback: string;
	hrvWeeklyAverage: number;
	sleepHistoryFactorPercent: number;
	sleepHistoryFactorFeedback: string;
	recoveryTimeFactorPercent: number;
	recoveryTimeFactorFeedback: string;
	stressHistoryFactorPercent: number;
	stressHistoryFactorFeedback: string;
	acwrFactorPercent: number;
	acwrFactorFeedback: string;
	recoveryTime: number;
	feedbackShort: string;
	feedbackLong: string;
	inputContext: string;
}

// --- Fetchers ---

export async function fetchTrainingStatus(): Promise<TrainingStatus> {
	const raw = await garmin<RawTrainingStatusResponse>(['training', 'status']);
	const statusMap = raw.mostRecentTrainingStatus.latestTrainingStatusData;
	const status = Object.values(statusMap)[0];
	const balanceMap = raw.mostRecentTrainingLoadBalance.metricsTrainingLoadBalanceDTOMap;
	const loadBalance = Object.values(balanceMap)[0];
	const vo2max = raw.mostRecentVO2Max.generic ?? {
		calendarDate: '',
		vo2MaxPreciseValue: 0,
		vo2MaxValue: 0,
		maxMetCategory: 0,
	};
	return { status, loadBalance, vo2max };
}

export async function fetchReadiness(): Promise<Readiness> {
	const raw = await garmin<RawReadinessEntry[]>(['training', 'readiness']);
	// First entry is the most recent wake-up reading
	return raw[0];
}

export async function fetchRacePredictions(): Promise<RacePredictions> {
	return garmin<RacePredictions>(['training', 'race-predictions']);
}

export async function fetchEnduranceScore(): Promise<EnduranceScore> {
	return garmin<EnduranceScore>(['training', 'endurance-score']);
}

export async function fetchFitnessAge(): Promise<FitnessAge> {
	return garmin<FitnessAge>(['training', 'fitness-age']);
}

export async function fetchLactateThreshold(): Promise<LactateThreshold[]> {
	return garmin<LactateThreshold[]>(['training', 'lactate-threshold']);
}

export async function fetchHrv(): Promise<HrvDay[]> {
	return garmin<HrvDay[]>(['health', 'hrv', '--days', '30']);
}

export async function fetchActivities(): Promise<Activity[]> {
	return garmin<Activity[]>(['activities', 'list', '--limit', '20', '--type', 'running']);
}
