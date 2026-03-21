// --- Training Status ---

export interface AcuteTrainingLoad {
	acwrPercent: number;
	acwrStatus: string; // "LOW" | "OPTIMAL" | "HIGH" | "VERY_HIGH"
	acwrStatusFeedback: string;
	dailyAcuteChronicWorkloadRatio: number;
	dailyTrainingLoadAcute: number;
	dailyTrainingLoadChronic: number;
	maxTrainingLoadChronic: number;
	minTrainingLoadChronic: number;
}

export interface TrainingStatusData {
	acuteTrainingLoadDTO: AcuteTrainingLoad;
	calendarDate: string;
	deviceId: number;
	fitnessTrend: number; // 1 = up, 0 = stable, -1 = down
	fitnessTrendSport: string;
	sport: string;
	trainingStatus: number;
	trainingStatusFeedbackPhrase: string; // "DETRAINING", "PRODUCTIVE", etc.
	trainingPaused: boolean;
}

export interface LoadBalance {
	calendarDate: string;
	monthlyLoadAerobicHigh: number;
	monthlyLoadAerobicHighTargetMax: number;
	monthlyLoadAerobicHighTargetMin: number;
	monthlyLoadAerobicLow: number;
	monthlyLoadAerobicLowTargetMax: number;
	monthlyLoadAerobicLowTargetMin: number;
	monthlyLoadAnaerobic: number;
	monthlyLoadAnaerobicTargetMax: number;
	monthlyLoadAnaerobicTargetMin: number;
	trainingBalanceFeedbackPhrase: string;
}

export interface VO2Max {
	calendarDate: string;
	vo2MaxPreciseValue: number;
	vo2MaxValue: number;
	maxMetCategory: number;
}

export interface TrainingStatus {
	status: TrainingStatusData;
	loadBalance: LoadBalance;
	vo2max: VO2Max;
}

// --- Readiness ---

export interface Readiness {
	score: number;
	level: string; // "HIGH" | "MODERATE" | "LOW"
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
}

// --- Race Predictions ---

export interface RacePredictions {
	calendarDate: string;
	time5K: number; // seconds
	time10K: number;
	timeHalfMarathon: number;
	timeMarathon: number;
}

// --- Endurance Score ---

export interface EnduranceScore {
	overallScore: number;
	classification: number;
	classificationLowerLimitIntermediate: number;
	classificationLowerLimitTrained: number;
	classificationLowerLimitWellTrained: number;
	classificationLowerLimitExpert: number;
	classificationLowerLimitSuperior: number;
	classificationLowerLimitElite: number;
	gaugeLowerLimit: number;
	gaugeUpperLimit: number;
	feedbackPhrase: number;
}

// --- Fitness Age ---

export interface FitnessAge {
	fitnessAge: number;
	chronologicalAge: number;
	achievableFitnessAge: number;
	components: {
		bmi: { value: number; stale: boolean };
		rhr: { value: number; stale: boolean };
		vigorousDaysAvg: { value: number; stale: boolean };
		vigorousMinutesAvg: { value: number; stale: boolean };
	};
}

// --- Lactate Threshold ---

export interface LactateThreshold {
	calendarDate: string;
	hearRate: number | null;
	speed: number | null;
}

// --- HRV ---

export interface HrvSummary {
	calendarDate: string;
	weeklyAvg: number;
	lastNightAvg: number;
	lastNight5MinHigh: number;
	status: string; // "BALANCED" | "UNBALANCED" | "LOW"
	feedbackPhrase: string;
	baseline: {
		balancedLow: number;
		balancedUpper: number;
		lowUpper: number;
		markerValue: number;
	};
}

export interface HrvDay {
	startTimestampLocal: string;
	endTimestampLocal: string;
	hrvSummary: HrvSummary;
}

// --- Activities ---

export interface Activity {
	id: number;
	name: string;
	activity_type: string;
	start_time: string;
	distance_meters: number;
	duration_seconds: number;
	avg_hr: number | null;
	max_hr: number | null;
	calories: number | null;
	pace_min_km: string | null;
	// Enriched fields (new CLI version)
	training_effect_label: string | null;
	activity_training_load: number | null;
	aerobic_training_effect: number | null;
	anaerobic_training_effect: number | null;
}

// --- Dashboard aggregate ---

export interface DashboardData {
	trainingStatus: TrainingStatus;
	readiness: Readiness;
	racePredictions: RacePredictions;
	enduranceScore: EnduranceScore;
	fitnessAge: FitnessAge;
	lactateThreshold: LactateThreshold[];
	hrv: HrvDay[];
	activities: Activity[];
	lastRunDate: string | null;
	daysSinceLastRun: number | null;
}
