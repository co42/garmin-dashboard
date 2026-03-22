import { getDb } from './db.js';
import type {
	DashboardData,
	DailyTrainingStatus,
	Readiness,
	RacePredictions,
	EnduranceScore,
	HillScore,
	FitnessAge,
	LactateThreshold,
	StressDay,
	BodyBattery,
	HrvDay,
	HeartRateDay,
	SleepScoreDay,
	Activity,
	ActivitySplit,
	PersonalRecord,
	GearItem,
	CalendarEntry,
} from './types.js';

function snapshot<T>(command: string, fallback: T): T {
	const db = getDb();
	const row = db.prepare('SELECT data FROM snapshots WHERE command = ?').get(command) as { data: string } | undefined;
	return row ? JSON.parse(row.data) : fallback;
}

function daysBetween(a: string, b: string): number {
	return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function loadDashboard(): DashboardData | null {
	const db = getDb();

	// Check if we have any data
	const hasData = db.prepare('SELECT 1 FROM snapshots LIMIT 1').get();
	if (!hasData) return null;

	// Current status (latest day from daily_status)
	const latestStatusRow = db.prepare(
		'SELECT data FROM daily_status ORDER BY date DESC LIMIT 1'
	).get() as { data: string } | undefined;
	const currentStatus: DailyTrainingStatus = latestStatusRow
		? JSON.parse(latestStatusRow.data)
		: null;

	if (!currentStatus) return null;

	// Status history (all daily_status, ordered)
	const statusRows = db.prepare(
		'SELECT data FROM daily_status ORDER BY date ASC'
	).all() as { data: string }[];
	const statusHistory = statusRows.map(r => JSON.parse(r.data) as DailyTrainingStatus);

	// Snapshots
	const readiness = snapshot<Readiness>('readiness', {
		score: 0, level: 'UNKNOWN', date: '', hrv_score: 0, hrv_feedback: '',
		hrv_weekly_average: 0, sleep_history_score: 0, sleep_history_feedback: '',
		recovery_score: 0, recovery_feedback: '', stress_score: 0, stress_feedback: '',
		acwr_score: 0, acwr_feedback: '', recovery_time_minutes: 0, feedback: '',
		sleep_score: 0, sleep_feedback: '',
	});

	const racePredictions = snapshot<RacePredictions>('race_predictions', {
		date: '', time_5k_seconds: 0, time_10k_seconds: 0, time_half_marathon_seconds: 0,
		time_marathon_seconds: 0, pace_5k: '', pace_10k: '', pace_half_marathon: '', pace_marathon: '',
	});

	const enduranceScore = snapshot<EnduranceScore>('endurance_score', {
		score: 0, classification: 'Unknown', date: '',
	});

	const hillScore = snapshot<HillScore>('hill_score', {
		date: '', overall: 0, strength: 0, endurance: 0, vo2max: 0,
	});

	const fitnessAge = snapshot<FitnessAge>('fitness_age', {
		fitness_age: 0, chronological_age: 0, achievable_fitness_age: 0,
		bmi: 0, resting_heart_rate: 0, vigorous_days_avg: 0, vigorous_minutes_avg: 0,
	});

	const lactateThreshold = snapshot<LactateThreshold>('lactate_threshold', {
		date: '', heart_rate: 0, pace: '', speed_meters_per_second: 0,
	});

	const stress = snapshot<StressDay>('stress', {
		date: '', avg_stress: 0, max_stress: 0, body_battery_high: 0,
		body_battery_low: 0, body_battery_latest: 0,
	});

	const bodyBattery = snapshot<BodyBattery>('body_battery', {
		date: '', high: 0, low: 0, latest: 0,
	});

	const records = snapshot<PersonalRecord[]>('records', []);
	const gear = snapshot<GearItem[]>('gear', []);
	const calendar = snapshot<CalendarEntry[]>('calendar', []);

	// Time-series
	const hrvRows = db.prepare(
		'SELECT date, status, weekly_average FROM daily_hrv ORDER BY date ASC'
	).all() as HrvDay[];

	const hrRows = db.prepare(
		'SELECT date, resting_hr, avg_7day_resting, max_hr, min_hr FROM daily_heart_rate ORDER BY date ASC'
	).all() as HeartRateDay[];

	const sleepRows = db.prepare(
		'SELECT date, score FROM daily_sleep_score ORDER BY date ASC'
	).all() as SleepScoreDay[];

	const hillScoreRows = db.prepare(
		'SELECT date, overall, strength, endurance FROM weekly_hill_score ORDER BY date ASC'
	).all() as { date: string; overall: number; strength: number; endurance: number }[];
	const hillScoreHistory: HillScore[] = hillScoreRows.map(r => ({
		date: r.date, overall: r.overall, strength: r.strength, endurance: r.endurance, vo2max: 0,
	}));

	const enduranceScoreRows = db.prepare(
		'SELECT date, score, classification FROM weekly_endurance_score ORDER BY date ASC'
	).all() as { date: string; score: number; classification: string }[];
	const enduranceScoreHistory: EnduranceScore[] = enduranceScoreRows.map(r => ({
		date: r.date, score: r.score, classification: r.classification,
	}));

	// Activities
	const activityRows = db.prepare(
		'SELECT data FROM activities ORDER BY json_extract(data, \'$.start_time\') DESC'
	).all() as { data: string }[];
	const activities = activityRows.map(r => JSON.parse(r.data) as Activity);

	// Splits for last 5 activities (for pacing analysis)
	const recentSplits: Record<number, ActivitySplit[]> = {};
	const recentIds = activities.slice(0, 5).map(a => a.id);
	for (const id of recentIds) {
		const splitRows = db.prepare(
			'SELECT data FROM activity_splits WHERE activity_id = ? ORDER BY split ASC'
		).all(id) as { data: string }[];
		if (splitRows.length > 0) {
			recentSplits[id] = splitRows.map(r => JSON.parse(r.data) as ActivitySplit);
		}
	}

	// Computed
	const lastRunDate = activities.length > 0 ? activities[0].start_time : null;
	const daysSinceLastRun = lastRunDate
		? daysBetween(lastRunDate, new Date().toISOString())
		: null;

	// Last sync time
	const syncRow = db.prepare(
		'SELECT synced_at FROM snapshots ORDER BY synced_at DESC LIMIT 1'
	).get() as { synced_at: string } | undefined;

	return {
		currentStatus,
		readiness,
		racePredictions,
		enduranceScore,
		hillScore,
		fitnessAge,
		lactateThreshold,
		stress,
		bodyBattery,
		statusHistory,
		hrvHistory: hrvRows,
		heartRateHistory: hrRows,
		sleepScoreHistory: sleepRows,
		hillScoreHistory,
		enduranceScoreHistory,
		activities,
		recentSplits,
		records,
		gear,
		calendar,
		lastRunDate,
		daysSinceLastRun,
		lastSyncedAt: syncRow?.synced_at ?? null,
	};
}
