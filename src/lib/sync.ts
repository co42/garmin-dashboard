import { getDb } from './db.js';
import { garmin, garminSafe } from './garmin.js';
import type {
	DailyTrainingStatus,
	HrvDay,
	HeartRateDay,
	SleepScoreDay,
	Activity,
	ActivitySplit,
	HillScore,
	EnduranceScore,
	CalendarItem,
	CalendarEntry,
	WorkoutStep,
	HrZone,
} from './types.js';

export interface SyncResult {
	status: 'ok' | 'error';
	duration_ms: number;
	error?: string;
	counts: {
		status_days: number;
		hrv_days: number;
		hr_days: number;
		sleep_days: number;
		activities: number;
		splits: number;
	};
}

export async function runSync(): Promise<SyncResult> {
	const start = Date.now();
	const db = getDb();

	const logStmt = db.prepare('INSERT INTO sync_log (status) VALUES (?)');
	const { lastInsertRowid: logId } = logStmt.run('running');

	try {
		const isFirstSync = !db.prepare('SELECT 1 FROM daily_status LIMIT 1').get();
		const needsHillBackfill = !db.prepare('SELECT 1 FROM weekly_hill_score LIMIT 1').get();
		const historyDays = isFirstSync ? 90 : 7;
		const hillEnduranceDays = (isFirstSync || needsHillBackfill) ? 90 : 7;
		const activityLimit = isFirstSync ? 100 : 20;

		// Phase 1: Fetch all data in parallel
		const [
			statusHistory,
			readiness,
			racePredictions,
			enduranceScore,
			hillScore,
			fitnessAge,
			lactateThreshold,
			hrvHistory,
			heartRateHistory,
			sleepScoreHistory,
			stress,
			bodyBattery,
			records,
			gear,
			activities,
			hillScoreHistory,
			enduranceScoreHistory,
			hrZones,
		] = await Promise.all([
			garmin<DailyTrainingStatus[]>(['training', 'status', '--days', String(historyDays)]),
			garminSafe(['training', 'readiness'], null),
			garminSafe(['training', 'race-predictions'], null),
			garminSafe(['training', 'endurance-score'], null),
			garminSafe(['training', 'hill-score'], null),
			garminSafe(['training', 'fitness-age'], null),
			garminSafe(['training', 'lactate-threshold'], null),
			garminSafe<HrvDay[]>(['health', 'hrv', '--days', String(Math.min(historyDays, 30))], []),
			garminSafe<HeartRateDay[]>(['health', 'heart-rate', '--days', String(historyDays)], []),
			garminSafe<SleepScoreDay[]>(['health', 'sleep-scores', '--days', String(Math.min(historyDays, 30))], []),
			garminSafe(['health', 'stress'], null),
			garminSafe(['health', 'body-battery'], null),
			garminSafe(['records'], []),
			garminSafe(['gear', 'list'], []),
			garmin<Activity[]>(['activities', 'list', '--limit', String(activityLimit), '--type', 'running']),
			garminSafe<HillScore[]>(['training', 'hill-score', '--days', String(hillEnduranceDays)], []),
			garminSafe<EnduranceScore[]>(['training', 'endurance-score', '--days', String(hillEnduranceDays)], []),
			garminSafe<HrZone[]>(['training', 'zones'], []),
		]);

		// Phase 2: Store snapshots (always-fresh data)
		const upsertSnapshot = db.prepare(
			`INSERT INTO snapshots (command, data, synced_at) VALUES (?, ?, datetime('now'))
			 ON CONFLICT(command) DO UPDATE SET data = excluded.data, synced_at = excluded.synced_at`
		);
		const snapshotBatch = db.transaction(() => {
			if (readiness) upsertSnapshot.run('readiness', JSON.stringify(readiness));
			if (racePredictions) upsertSnapshot.run('race_predictions', JSON.stringify(racePredictions));
			if (enduranceScore) upsertSnapshot.run('endurance_score', JSON.stringify(enduranceScore));
			if (hillScore) upsertSnapshot.run('hill_score', JSON.stringify(hillScore));
			if (fitnessAge) upsertSnapshot.run('fitness_age', JSON.stringify(fitnessAge));
			if (lactateThreshold) upsertSnapshot.run('lactate_threshold', JSON.stringify(lactateThreshold));
			if (stress) upsertSnapshot.run('stress', JSON.stringify(stress));
			if (bodyBattery) upsertSnapshot.run('body_battery', JSON.stringify(bodyBattery));
			upsertSnapshot.run('records', JSON.stringify(records));
			upsertSnapshot.run('gear', JSON.stringify(gear));
			if (hrZones.length > 0) upsertSnapshot.run('hr_zones', JSON.stringify(hrZones));
		});
		snapshotBatch();

		// Phase 3: Store time-series data (upsert to deduplicate)
		const upsertStatus = db.prepare(
			`INSERT INTO daily_status (date, data) VALUES (?, ?)
			 ON CONFLICT(date) DO UPDATE SET data = excluded.data`
		);
		const upsertHrv = db.prepare(
			`INSERT INTO daily_hrv (date, status, weekly_average) VALUES (?, ?, ?)
			 ON CONFLICT(date) DO UPDATE SET status = excluded.status, weekly_average = excluded.weekly_average`
		);
		const upsertHr = db.prepare(
			`INSERT INTO daily_heart_rate (date, resting_hr, avg_7day_resting, max_hr, min_hr) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(date) DO UPDATE SET resting_hr = excluded.resting_hr, avg_7day_resting = excluded.avg_7day_resting,
			 max_hr = excluded.max_hr, min_hr = excluded.min_hr`
		);
		const upsertSleep = db.prepare(
			`INSERT INTO daily_sleep_score (date, score) VALUES (?, ?)
			 ON CONFLICT(date) DO UPDATE SET score = excluded.score`
		);
		const upsertHill = db.prepare(
			`INSERT INTO weekly_hill_score (date, overall, strength, endurance) VALUES (?, ?, ?, ?)
			 ON CONFLICT(date) DO UPDATE SET overall = excluded.overall, strength = excluded.strength, endurance = excluded.endurance`
		);
		const upsertEndurance = db.prepare(
			`INSERT INTO weekly_endurance_score (date, score, classification) VALUES (?, ?, ?)
			 ON CONFLICT(date) DO UPDATE SET score = excluded.score, classification = excluded.classification`
		);

		const timeseriesBatch = db.transaction(() => {
			for (const s of statusHistory) {
				upsertStatus.run(s.date, JSON.stringify(s));
			}
			for (const h of hrvHistory) {
				const d = h.date.slice(0, 10);
				upsertHrv.run(d, h.status, h.weekly_average);
			}
			for (const hr of heartRateHistory) {
				upsertHr.run(hr.date, hr.resting_hr, hr.avg_7day_resting, hr.max_hr, hr.min_hr);
			}
			for (const ss of sleepScoreHistory) {
				if (ss.score) upsertSleep.run(ss.date, ss.score);
			}
			for (const hs of hillScoreHistory) {
				if (hs.date && hs.overall != null) upsertHill.run(hs.date, hs.overall, hs.strength, hs.endurance);
			}
			for (const es of enduranceScoreHistory) {
				if (es.date && es.score != null) upsertEndurance.run(es.date, es.score, es.classification);
			}
		});
		timeseriesBatch();

		// Phase 4: Store activities + fetch splits for new ones
		const upsertActivity = db.prepare(
			`INSERT INTO activities (id, data, synced_at) VALUES (?, ?, datetime('now'))
			 ON CONFLICT(id) DO UPDATE SET data = excluded.data, synced_at = excluded.synced_at`
		);
		const existingIds = new Set(
			db.prepare('SELECT id FROM activities').all().map((r: any) => r.id)
		);
		const existingDetailIds = new Set(
			db.prepare('SELECT activity_id FROM activity_details').all().map((r: any) => r.activity_id)
		);
		const newActivityIds: number[] = [];

		const activityBatch = db.transaction(() => {
			for (const a of activities) {
				upsertActivity.run(a.id, JSON.stringify(a));
				if (!existingIds.has(a.id)) {
					newActivityIds.push(a.id);
				}
			}
		});
		activityBatch();

		// Phase 5: Fetch splits + details for new activities (parallel, batched)
		const upsertSplit = db.prepare(
			`INSERT INTO activity_splits (activity_id, split, data) VALUES (?, ?, ?)
			 ON CONFLICT(activity_id, split) DO UPDATE SET data = excluded.data`
		);
		const upsertDetail = db.prepare(
			`INSERT INTO activity_details (activity_id, polyline, timeseries, metric_keys) VALUES (?, ?, ?, ?)
			 ON CONFLICT(activity_id) DO UPDATE SET polyline = excluded.polyline, timeseries = excluded.timeseries, metric_keys = excluded.metric_keys`
		);

		// Also backfill details for existing activities that don't have them yet
		const backfillIds = activities
			.filter(a => !newActivityIds.includes(a.id) && !existingDetailIds.has(a.id))
			.map(a => a.id);

		// Fetch splits + details in batches of 5
		let totalSplits = 0;
		const allIdsToFetch = [...newActivityIds, ...backfillIds];
		for (let i = 0; i < allIdsToFetch.length; i += 5) {
			const batch = allIdsToFetch.slice(i, i + 5);
			const isNewSet = new Set(newActivityIds);
			const results = await Promise.all(
				batch.map(async id => {
					const isNew = isNewSet.has(id);
					const [splits, details] = await Promise.all([
						isNew ? garminSafe<ActivitySplit[]>(['activities', 'splits', String(id)], []) : Promise.resolve([]),
						garminSafe<any>(['activities', 'details', String(id)], null),
					]);
					return { id, splits, details, isNew };
				})
			);

			const splitBatch = db.transaction(() => {
				for (const { id, splits, details, isNew } of results) {
					for (const s of splits) {
						upsertSplit.run(id, s.split, JSON.stringify(s));
						totalSplits++;
					}
					if (details) {
						const polyline = extractPolyline(details);
						const { timeseries, metricKeys } = extractTimeseries(details);
						upsertDetail.run(
							id,
							JSON.stringify(polyline),
							JSON.stringify(timeseries),
							JSON.stringify(metricKeys),
						);
					}
				}
			});
			splitBatch();
		}

		// Phase 6: Calendar + workout steps
		const calendarItems = await garminSafe<CalendarItem[]>(['calendar', '--weeks', '4'], []);
		const calendarEntries: CalendarEntry[] = [];

		// Collect items that have workout IDs for batch fetching
		const workoutItems = calendarItems.filter(
			(ci): ci is CalendarItem & { workout_id: number } => ci.workout_id != null
		);

		// Fetch workout details in batches of 5 (deduplicate by workout_id)
		const uniqueWorkoutIds = [...new Set(workoutItems.map(ci => ci.workout_id))];
		const workoutStepsMap = new Map<number, WorkoutStep[]>();
		const workoutRawMap = new Map<number, any>();
		for (let i = 0; i < uniqueWorkoutIds.length; i += 5) {
			const batch = uniqueWorkoutIds.slice(i, i + 5);
			const results = await Promise.all(
				batch.map(id =>
					garminSafe<any>(['workouts', 'get', String(id)], null)
						.then(raw => ({ workoutId: id, raw }))
				)
			);
			for (const { workoutId, raw } of results) {
				if (raw) {
					workoutRawMap.set(workoutId, raw);
					workoutStepsMap.set(workoutId, parseWorkoutSteps(raw));
				}
			}
		}

		for (const ci of calendarItems) {
			if (!ci.title || !ci.date) continue;
			const raw = ci.workout_id != null ? workoutRawMap.get(ci.workout_id) : null;
			calendarEntries.push({
				id: ci.id,
				item_type: ci.item_type,
				sport_type: raw?.sportType?.sportTypeKey ?? null,
				title: ci.title,
				date: ci.date,
				workout_id: ci.workout_id,
				steps: ci.workout_id != null ? (workoutStepsMap.get(ci.workout_id) ?? []) : [],
			});
		}

		upsertSnapshot.run('calendar', JSON.stringify(calendarEntries));

		// Finish
		db.prepare('UPDATE sync_log SET finished_at = datetime(?), status = ? WHERE id = ?')
			.run(new Date().toISOString(), 'ok', logId);

		return {
			status: 'ok',
			duration_ms: Date.now() - start,
			counts: {
				status_days: statusHistory.length,
				hrv_days: hrvHistory.length,
				hr_days: heartRateHistory.length,
				sleep_days: sleepScoreHistory.filter(s => s.score).length,
				activities: activities.length,
				splits: totalSplits,
			},
		};
	} catch (err: any) {
		db.prepare('UPDATE sync_log SET finished_at = datetime(?), status = ?, error = ? WHERE id = ?')
			.run(new Date().toISOString(), 'error', err.message, logId);

		return {
			status: 'error',
			duration_ms: Date.now() - start,
			error: err.message,
			counts: { status_days: 0, hrv_days: 0, hr_days: 0, sleep_days: 0, activities: 0, splits: 0 },
		};
	}
}

function extractPolyline(details: any): [number, number][] {
	const poly = details?.geoPolylineDTO?.polyline;
	if (!Array.isArray(poly)) return [];
	return poly
		.filter((p: any) => p.lat != null && p.lon != null)
		.map((p: any) => [p.lat, p.lon]);
}

function extractTimeseries(details: any): { timeseries: any[]; metricKeys: string[] } {
	const descriptors: any[] = details?.metricDescriptors ?? [];
	const metrics: any[] = details?.activityDetailMetrics ?? [];

	// Build index map: key -> metricsIndex (= position in the metrics[] array)
	// The API pre-decodes FIT data — values are already in real units (m/s, meters, bpm).
	// The factor field is a display hint, NOT a scaling factor to apply.
	const indexMap = new Map<string, number>();
	for (const d of descriptors) {
		indexMap.set(d.key, d.metricsIndex);
	}

	const idx = {
		dist: indexMap.get('sumDistance'),
		hr: indexMap.get('directHeartRate'),
		speed: indexMap.get('directSpeed'),
		elev: indexMap.get('directElevation'),
		power: indexMap.get('directPower'),
		cadence: indexMap.get('directDoubleCadence') ?? indexMap.get('directRunCadence'),
		gap: indexMap.get('directGradeAdjustedSpeed'),
		lat: indexMap.get('directLatitude'),
		lon: indexMap.get('directLongitude'),
	};

	const timeseries = [];
	for (const point of metrics) {
		const m = point.metrics;
		if (!m) continue;

		const rawSpeed = idx.speed != null ? m[idx.speed] : null;
		const rawGap = idx.gap != null ? m[idx.gap] : null;

		// Speed already in m/s → pace in sec/km
		const pace = rawSpeed && rawSpeed > 0 ? 1000 / rawSpeed : null;
		const gapPace = rawGap && rawGap > 0 ? 1000 / rawGap : null;

		timeseries.push({
			dist: idx.dist != null && m[idx.dist] != null ? m[idx.dist] : 0,
			hr: idx.hr != null ? m[idx.hr] : null,
			pace: pace != null ? Math.round(pace * 10) / 10 : null,
			elev: idx.elev != null ? m[idx.elev] : null,
			power: idx.power != null ? m[idx.power] : null,
			cadence: idx.cadence != null ? m[idx.cadence] : null,
			gap: gapPace != null ? Math.round(gapPace * 10) / 10 : null,
			lat: idx.lat != null ? m[idx.lat] : null,
			lon: idx.lon != null ? m[idx.lon] : null,
		});
	}

	return { timeseries, metricKeys: [...indexMap.keys()] };
}

function parseRawStep(step: any): WorkoutStep {
	return {
		type: step.type ?? '',
		step_type: step.stepType?.stepTypeKey ?? '',
		end_condition: step.endCondition?.conditionTypeKey ?? '',
		end_condition_value: step.endConditionValue ?? 0,
		target_type: step.targetType?.workoutTargetTypeKey ?? null,
		target_value_one: step.targetValueOne ?? null,
		target_value_two: step.targetValueTwo ?? null,
		description: step.description ?? null,
		exercise_name: step.exerciseName ?? null,
		category: step.category ?? null,
		number_of_iterations: step.numberOfIterations ?? null,
		steps: step.type === 'RepeatGroupDTO' && Array.isArray(step.workoutSteps)
			? step.workoutSteps.map(parseRawStep)
			: null,
	};
}

function parseWorkoutSteps(raw: any): WorkoutStep[] {
	const segments = raw?.workoutSegments;
	if (!Array.isArray(segments) || segments.length === 0) return [];
	const rawSteps = segments[0]?.workoutSteps;
	if (!Array.isArray(rawSteps)) return [];
	return rawSteps.map(parseRawStep);
}
