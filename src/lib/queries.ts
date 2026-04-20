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
	ActivityDetails,
	ActivityWeather,
	PersonalRecord,
	GearItem,
	CalendarEntry,
	HrZone,
	UserSettings,
	Course,
	CourseGeoPoint,
} from './types.js';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function snapshot<T>(command: string, fallback: T): T {
	const db = getDb();
	const row = db.prepare('SELECT data FROM snapshots WHERE command = ?').get(command) as { data: string } | undefined;
	return row ? JSON.parse(row.data) : fallback;
}

function loadDaily<T>(table: string): T[] {
	const db = getDb();
	const rows = db.prepare(`SELECT data FROM ${table} ORDER BY date ASC`).all() as { data: string }[];
	return rows.map(r => JSON.parse(r.data));
}

function daysBetween(a: string, b: string): number {
	const da = new Date(a.slice(0, 10) + 'T00:00:00Z');
	const db = new Date(b.slice(0, 10) + 'T00:00:00Z');
	return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Dashboard loader
// ---------------------------------------------------------------------------

export function loadDashboard(): DashboardData | null {
	const db = getDb();

	// Check if we have any data
	const hasData = db.prepare('SELECT 1 FROM snapshots LIMIT 1').get();
	if (!hasData) return null;

	// Current status (latest day)
	const latestStatusRow = db.prepare(
		"SELECT data FROM daily_training_status WHERE json_extract(data, '$.status') IS NOT NULL ORDER BY date DESC LIMIT 1"
	).get() as { data: string } | undefined;
	const currentStatus: DailyTrainingStatus = latestStatusRow
		? JSON.parse(latestStatusRow.data)
		: null;

	if (!currentStatus) return null;

	// Time-series (all uniform JSON blob reads)
	const statusHistory = loadDaily<DailyTrainingStatus>('daily_training_status');
	const hrvHistory = loadDaily<HrvDay>('daily_hrv');
	const heartRateHistory = loadDaily<HeartRateDay>('daily_heart_rate');
	const sleepScoreHistory = loadDaily<SleepScoreDay>('daily_sleep_score');
	const stressHistory = loadDaily<StressDay>('daily_stress');
	const hillScoreHistory = loadDaily<HillScore>('daily_hill_score');
	const enduranceScoreHistory = loadDaily<EnduranceScore>('daily_endurance_score');
	const racePredictionHistory = loadDaily<RacePredictions>('daily_race_predictions');

	// Snapshots
	const readiness = snapshot<Readiness>('readiness', {
		date: '',
		morning: null,
		post_activity: null,
		latest: null,
	});

	const racePredictions = snapshot<RacePredictions>('race_predictions', {
		date: '', time_5k_seconds: 0, time_10k_seconds: 0, time_half_marathon_seconds: 0,
		time_marathon_seconds: 0, time_5k: '', time_10k: '', time_half_marathon: '', time_marathon: '',
		pace_5k: '', pace_10k: '', pace_half_marathon: '', pace_marathon: '',
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

	const lactateThresholdHistory = snapshot<LactateThreshold[]>('lactate_threshold_history', []);

	const stress = snapshot<StressDay>('stress', {
		date: '', avg_stress: 0, max_stress: 0,
	});

	const bodyBattery = snapshot<BodyBattery>('body_battery', {
		date: '', body_battery_high: 0, body_battery_low: 0, body_battery_latest: 0,
	});

	const records = snapshot<PersonalRecord[]>('records', []);
	const gear = snapshot<GearItem[]>('gear', []);
	const calendar = snapshot<CalendarEntry[]>('calendar', []);
	const hrZones = snapshot<HrZone[]>('hr_zones', []);
	const userSettings = snapshot<UserSettings | null>('user_settings', null);

	// Activities
	const activityRows = db.prepare(
		'SELECT data FROM activities ORDER BY json_extract(data, \'$.start_time\') DESC'
	).all() as { data: string }[];
	const activities = activityRows.map(r => JSON.parse(r.data) as Activity);

	// Splits for all displayed activities
	const recentSplits: Record<number, ActivitySplit[]> = {};
	for (const a of activities) {
		const splitRows = db.prepare(
			'SELECT data FROM activity_splits WHERE activity_id = ? ORDER BY split ASC'
		).all(a.id) as { data: string }[];
		if (splitRows.length > 0) {
			recentSplits[a.id] = splitRows.map(r => JSON.parse(r.data) as ActivitySplit);
		}
	}

	// Activity details (polyline + timeseries from cache columns)
	const activityDetails: Record<number, ActivityDetails> = {};
	const detailRows = db.prepare(
		'SELECT activity_id, polyline, timeseries FROM activity_details'
	).all() as { activity_id: number; polyline: string; timeseries: string }[];
	for (const r of detailRows) {
		activityDetails[r.activity_id] = {
			polyline: JSON.parse(r.polyline),
			timeseries: JSON.parse(r.timeseries),
		};
	}

	// Activity weather
	const activityWeather: Record<number, ActivityWeather> = {};
	const weatherRows = db.prepare(
		'SELECT activity_id, data FROM activity_weather'
	).all() as { activity_id: number; data: string }[];
	for (const r of weatherRows) {
		activityWeather[r.activity_id] = JSON.parse(r.data) as ActivityWeather;
	}

	// Courses
	const courseRows = db.prepare(
		'SELECT data, geo_points FROM courses ORDER BY json_extract(data, \'$.created_date\') DESC'
	).all() as { data: string; geo_points: string | null }[];
	const courses: Course[] = courseRows.map(r => {
		const data = JSON.parse(r.data);
		return {
			...data,
			geo_points: r.geo_points ? JSON.parse(r.geo_points) as CourseGeoPoint[] : [],
		};
	});

	// Computed
	const lastRunDate = activities.length > 0 ? activities[0].start_time.slice(0, 10) : null;
	const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
	const daysSinceLastRun = lastRunDate
		? Math.max(0, daysBetween(lastRunDate, todayStr))
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
		hrvHistory,
		heartRateHistory,
		sleepScoreHistory,
		stressHistory,
		hillScoreHistory,
		enduranceScoreHistory,
		racePredictionHistory,
		lactateThresholdHistory,
		activities,
		recentSplits,
		activityDetails,
		activityWeather,
		records,
		gear,
		courses,
		calendar,
		hrZones,
		userSettings,
		lastRunDate,
		daysSinceLastRun,
		lastSyncedAt: syncRow?.synced_at ?? null,
	};
}

export { resolveReadiness } from './readiness.js';
