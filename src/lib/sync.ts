import { getDb } from './db.js';
import { garmin, garminSafe } from './garmin.js';
import type {
	DailyTrainingStatus,
	HrvDay,
	HeartRateDay,
	SleepScoreDay,
	StressDay,
	Activity,
	ActivitySplit,
	ActivityWeather,
	HillScore,
	EnduranceScore,
	CalendarItem,
	CalendarEntry,
	WorkoutStep,
	HrZone,
	UserSettings,
	Course,
	CourseGeoPoint,
	RacePredictions,
	GearItem,
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
		stress_days: number;
		hill_days: number;
		endurance_days: number;
		activities: number;
		splits: number;
		weather: number;
		courses: number;
	};
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Today in Europe/Paris wall-clock time (server runs in this TZ). */
function todayISO(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

function addDays(dateStr: string, n: number): string {
	const d = new Date(dateStr + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Paginated date-range fetching
// ---------------------------------------------------------------------------

/** Fetch a time-series endpoint in 30-day chunks using --from/--to. */
async function fetchDateRange<T extends { date: string }>(
	args: string[],
	fromDate: string,
	toDate: string,
	chunkDays: number = 30,
): Promise<T[]> {
	// Generate chunks
	const chunks: { from: string; to: string }[] = [];
	let cursor = fromDate;
	while (cursor <= toDate) {
		const chunkEnd = addDays(cursor, chunkDays - 1);
		chunks.push({ from: cursor, to: chunkEnd > toDate ? toDate : chunkEnd });
		cursor = addDays(chunkEnd, 1);
	}

	// Fetch in parallel batches of 3
	const results: T[] = [];
	for (let i = 0; i < chunks.length; i += 3) {
		const batch = chunks.slice(i, i + 3);
		const batchResults = await Promise.all(
			batch.map(c =>
				garminSafe<T[]>([...args, '--from', c.from, '--to', c.to], [])
			)
		);
		for (const arr of batchResults) {
			results.push(...arr);
		}
	}

	// Deduplicate by date (keep last occurrence = freshest)
	const byDate = new Map<string, T>();
	for (const item of results) {
		const key = item.date.slice(0, 10);
		byDate.set(key, item);
	}
	return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Sync window computation
// ---------------------------------------------------------------------------

function getLastSuccessfulSync(db: ReturnType<typeof getDb>): string | null {
	const row = db.prepare(
		"SELECT finished_at FROM sync_log WHERE status = 'ok' ORDER BY finished_at DESC LIMIT 1"
	).get() as { finished_at: string } | undefined;
	return row?.finished_at?.slice(0, 10) ?? null;
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

export async function runSync(fullReset = false): Promise<SyncResult> {
	const start = Date.now();
	const db = getDb();

	if (fullReset) {
		for (const table of ['snapshots', 'daily_training_status', 'daily_hrv', 'daily_heart_rate', 'daily_sleep_score', 'daily_stress', 'daily_hill_score', 'daily_endurance_score', 'daily_race_predictions', 'activities', 'activity_splits', 'activity_details', 'activity_weather', 'courses', 'sync_log']) {
			db.exec(`DELETE FROM ${table}`);
		}
	}

	const logStmt = db.prepare('INSERT INTO sync_log (status) VALUES (?)');
	const { lastInsertRowid: logId } = logStmt.run('running');

	try {
		const today = todayISO();
		const lastSync = getLastSuccessfulSync(db);
		const isFirstSync = !lastSync;

		// Sync window: first sync = 365 days back, incremental = since last sync - 1 day overlap
		const fromDate = isFirstSync ? addDays(today, -365) : addDays(lastSync, -1);
		const activityLimit = isFirstSync ? 500 : 50;
		const activityAfter = isFirstSync ? addDays(today, -365) : addDays(lastSync, -1);

		// Phase 1: Fetch all data in parallel
		// Snapshots (latest-only) + time-series (date-range paginated)
		const [
			// Snapshots
			readiness,
			racePredictions,
			enduranceScore,
			hillScore,
			fitnessAge,
			lactateThreshold,
			stressSnapshot,
			bodyBattery,
			records,
			gear,
			hrZones,
			userSettings,
			// Time-series (paginated)
			statusHistory,
			hrvHistory,
			heartRateHistory,
			sleepScoreHistory,
			stressHistory,
			hillScoreHistory,
			enduranceScoreHistory,
			racePredictionHistory,
			// Activities
			activities,
		] = await Promise.all([
			// Snapshots
			garminSafe(['training', 'readiness'], null),
			garminSafe(['training', 'race-predictions'], null),
			garminSafe(['training', 'endurance-score'], null),
			garminSafe(['training', 'hill-score'], null),
			garminSafe(['training', 'fitness-age'], null),
			garminSafe(['training', 'lactate-threshold'], null),
			garminSafe(['health', 'stress'], null),
			garminSafe(['health', 'body-battery'], null),
			garminSafe(['records'], []),
			garminSafe(['gear', 'list'], []),
			garminSafe<HrZone[]>(['training', 'hr-zones'], []),
			garminSafe<UserSettings | null>(['profile', 'settings'], null),
			// Time-series
			fetchDateRange<DailyTrainingStatus>(['training', 'status'], fromDate, today),
			fetchDateRange<HrvDay>(['health', 'hrv'], fromDate, today),
			fetchDateRange<HeartRateDay>(['health', 'heart-rate'], fromDate, today),
			fetchDateRange<SleepScoreDay>(['health', 'sleep-scores'], fromDate, today),
			fetchDateRange<StressDay>(['health', 'stress'], fromDate, today),
			fetchDateRange<HillScore>(['training', 'hill-score'], fromDate, today),
			fetchDateRange<EnduranceScore>(['training', 'endurance-score'], fromDate, today),
			fetchDateRange<RacePredictions>(['training', 'race-predictions'], fromDate, today),
			// Activities
			garmin<Activity[]>(['activities', 'list', '--limit', String(activityLimit), '--type', 'running', '--after', activityAfter]),
		]);

		// Enrich gear with usage stats
		interface GearListItem { uuid: string; display_name: string; brand: string; gear_type: string; max_distance_meters: number; date_begin: string | null; }
		interface GearStats { uuid: string; total_activities: number; total_distance_meters: number; }
		const enrichedGear: GearItem[] = await Promise.all(
			(gear as GearListItem[]).map(async (g) => {
				const stats = await garminSafe<GearStats>(['gear', 'stats', g.uuid], { uuid: g.uuid, total_activities: 0, total_distance_meters: 0 });
				return {
					uuid: g.uuid,
					display_name: g.display_name,
					brand: g.brand,
					gear_type: g.gear_type,
					distance_meters: stats.total_distance_meters,
					max_distance_meters: g.max_distance_meters,
					activities: stats.total_activities,
					date_begin: g.date_begin,
				};
			})
		);

		// Phase 2: Store snapshots (always-fresh data)
		const upsertSnapshot = db.prepare(
			`INSERT INTO snapshots (command, data, synced_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
			 ON CONFLICT(command) DO UPDATE SET data = excluded.data, synced_at = excluded.synced_at`
		);
		const snapshotBatch = db.transaction(() => {
			if (readiness) upsertSnapshot.run('readiness', JSON.stringify(readiness));
			if (racePredictions) upsertSnapshot.run('race_predictions', JSON.stringify(racePredictions));
			if (enduranceScore) upsertSnapshot.run('endurance_score', JSON.stringify(enduranceScore));
			if (hillScore) upsertSnapshot.run('hill_score', JSON.stringify(hillScore));
			if (fitnessAge) upsertSnapshot.run('fitness_age', JSON.stringify(fitnessAge));
			if (lactateThreshold) upsertSnapshot.run('lactate_threshold', JSON.stringify(lactateThreshold));
			if (stressSnapshot) upsertSnapshot.run('stress', JSON.stringify(stressSnapshot));
			if (bodyBattery) upsertSnapshot.run('body_battery', JSON.stringify(bodyBattery));
			upsertSnapshot.run('records', JSON.stringify(records));
			upsertSnapshot.run('gear', JSON.stringify(enrichedGear));
			if (hrZones.length > 0) upsertSnapshot.run('hr_zones', JSON.stringify(hrZones));
			if (userSettings) upsertSnapshot.run('user_settings', JSON.stringify(userSettings));
		});
		snapshotBatch();

		// Phase 3: Store time-series (all JSON blobs, uniform pattern)
		const upsertDaily = (table: string) => db.prepare(
			`INSERT INTO ${table} (date, data) VALUES (?, ?)
			 ON CONFLICT(date) DO UPDATE SET data = excluded.data`
		);

		const stmtStatus = upsertDaily('daily_training_status');
		const stmtHrv = upsertDaily('daily_hrv');
		const stmtHr = upsertDaily('daily_heart_rate');
		const stmtSleep = upsertDaily('daily_sleep_score');
		const stmtStress = upsertDaily('daily_stress');
		const stmtHill = upsertDaily('daily_hill_score');
		const stmtEndurance = upsertDaily('daily_endurance_score');
		const stmtRacePred = upsertDaily('daily_race_predictions');

		const timeseriesBatch = db.transaction(() => {
			for (const s of statusHistory) {
				stmtStatus.run(s.date, JSON.stringify(s));
			}
			for (const h of hrvHistory) {
				// HRV dates come as timestamps — normalize to YYYY-MM-DD
				const date = h.date.slice(0, 10);
				stmtHrv.run(date, JSON.stringify({ ...h, date }));
			}
			for (const hr of heartRateHistory) {
				stmtHr.run(hr.date, JSON.stringify(hr));
			}
			for (const ss of sleepScoreHistory) {
				if (ss.score) stmtSleep.run(ss.date, JSON.stringify(ss));
			}
			for (const st of stressHistory) {
				stmtStress.run(st.date, JSON.stringify(st));
			}
			for (const hs of hillScoreHistory) {
				if (hs.date && hs.overall != null) stmtHill.run(hs.date, JSON.stringify(hs));
			}
			for (const es of enduranceScoreHistory) {
				if (es.date && es.score != null) stmtEndurance.run(es.date, JSON.stringify(es));
			}
			for (const rp of racePredictionHistory) {
				if (rp.date && rp.time_5k_seconds) stmtRacePred.run(rp.date, JSON.stringify(rp));
			}
		});
		timeseriesBatch();

		// Phase 4: Store activities + fetch splits for new ones
		const upsertActivity = db.prepare(
			`INSERT INTO activities (id, data, synced_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
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
			`INSERT INTO activity_details (activity_id, raw, polyline, timeseries, metric_keys) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(activity_id) DO UPDATE SET raw = excluded.raw, polyline = excluded.polyline, timeseries = excluded.timeseries, metric_keys = excluded.metric_keys`
		);
		const upsertWeather = db.prepare(
			`INSERT INTO activity_weather (activity_id, data) VALUES (?, ?)
			 ON CONFLICT(activity_id) DO UPDATE SET data = excluded.data`
		);
		const existingWeatherIds = new Set(
			db.prepare('SELECT activity_id FROM activity_weather').all().map((r: any) => r.activity_id)
		);

		// Also backfill details for existing activities that don't have them yet
		const backfillIds = activities
			.filter(a => !newActivityIds.includes(a.id) && !existingDetailIds.has(a.id))
			.map(a => a.id);

		// Fetch splits + details + weather in batches of 5
		let totalSplits = 0;
		let totalWeather = 0;
		const allIdsToFetch = [...newActivityIds, ...backfillIds];
		// Also fetch weather for activities that don't have it yet
		const weatherIds = activities.filter(a => !existingWeatherIds.has(a.id)).map(a => a.id);
		const weatherIdsSet = new Set(weatherIds);

		for (let i = 0; i < allIdsToFetch.length; i += 5) {
			const batch = allIdsToFetch.slice(i, i + 5);
			const isNewSet = new Set(newActivityIds);
			const results = await Promise.all(
				batch.map(async id => {
					const isNew = isNewSet.has(id);
					const needsWeather = weatherIdsSet.has(id);
					const [splits, details, weather] = await Promise.all([
						isNew ? garminSafe<ActivitySplit[]>(['activities', 'splits', String(id)], []) : Promise.resolve([]),
						garminSafe<any>(['activities', 'details', String(id)], null),
						needsWeather ? garminSafe<ActivityWeather | null>(['activities', 'weather', String(id)], null) : Promise.resolve(null),
					]);
					if (needsWeather) weatherIdsSet.delete(id);
					return { id, splits, details, weather, isNew };
				})
			);

			const splitBatch = db.transaction(() => {
				for (const { id, splits, details, weather } of results) {
					for (const s of splits) {
						upsertSplit.run(id, s.split, JSON.stringify(s));
						totalSplits++;
					}
					if (details) {
						const rawJson = JSON.stringify(details);
						const polyline = extractPolyline(details);
						const { timeseries, metricKeys } = extractTimeseries(details);
						upsertDetail.run(
							id,
							rawJson,
							JSON.stringify(polyline),
							JSON.stringify(timeseries),
							JSON.stringify(metricKeys),
						);
					}
					if (weather) {
						upsertWeather.run(id, JSON.stringify(weather));
						totalWeather++;
					}
				}
			});
			splitBatch();
		}

		// Fetch weather for ALL activities in DB that don't have it yet
		// Re-query since we may have just inserted weather for some
		const currentWeatherIds = new Set(
			db.prepare('SELECT activity_id FROM activity_weather').all().map((r: any) => r.activity_id)
		);
		const allDbActivityIds = db.prepare('SELECT id FROM activities').all().map((r: any) => r.id as number);
		const remainingWeatherIds = allDbActivityIds.filter(id => !currentWeatherIds.has(id));
		for (let i = 0; i < remainingWeatherIds.length; i += 5) {
			const batch = remainingWeatherIds.slice(i, i + 5);
			const results = await Promise.all(
				batch.map(async id => {
					const weather = await garminSafe<ActivityWeather | null>(['activities', 'weather', String(id)], null);
					return { id, weather };
				})
			);
			const weatherBatch = db.transaction(() => {
				for (const { id, weather } of results) {
					if (weather) {
						upsertWeather.run(id, JSON.stringify(weather));
						totalWeather++;
					}
				}
			});
			weatherBatch();
		}

		// Phase 6: Courses
		const courseList = await garminSafe<any[]>(['courses', 'list'], []);
		const upsertCourse = db.prepare(
			`INSERT INTO courses (id, data, geo_points, synced_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
			 ON CONFLICT(id) DO UPDATE SET data = excluded.data, geo_points = COALESCE(excluded.geo_points, courses.geo_points), synced_at = excluded.synced_at`
		);
		const existingCourseGeoIds = new Set(
			db.prepare("SELECT id FROM courses WHERE geo_points IS NOT NULL AND json_array_length(geo_points) > 0")
				.all().map((r: any) => r.id)
		);

		// Fetch geo_points for courses that don't have them yet
		const coursesNeedingGeo = courseList.filter(c => !existingCourseGeoIds.has(c.id));
		for (let i = 0; i < coursesNeedingGeo.length; i += 5) {
			const batch = coursesNeedingGeo.slice(i, i + 5);
			const details = await Promise.all(
				batch.map(c => garminSafe<any>(['courses', 'get', String(c.id)], null))
			);
			const tx = db.transaction(() => {
				for (let j = 0; j < batch.length; j++) {
					const geoPoints = details[j]?.geo_points ?? [];
					upsertCourse.run(batch[j].id, JSON.stringify(batch[j]), JSON.stringify(geoPoints));
				}
			});
			tx();
		}

		// Update metadata for courses that already have geo_points
		const coursesWithGeo = courseList.filter(c => existingCourseGeoIds.has(c.id));
		if (coursesWithGeo.length > 0) {
			const updateMeta = db.prepare('UPDATE courses SET data = ?, synced_at = datetime(\'now\') WHERE id = ?');
			const metaTx = db.transaction(() => {
				for (const c of coursesWithGeo) {
					updateMeta.run(JSON.stringify(c), c.id);
				}
			});
			metaTx();
		}

		// Phase 7: Calendar + workout steps
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

		// Enrich events + adaptive workouts from raw calendar API
		const needsRawCalendar = calendarItems.filter(
			ci => (ci.item_type === 'event' || ci.item_type === 'fbtAdaptiveWorkout') && ci.date
		);
		const rawCalMonths = new Set<string>();
		for (const ci of needsRawCalendar) {
			const [y, m] = ci.date!.split('-');
			rawCalMonths.add(`${y}/${parseInt(m) - 1}`);
		}
		const rawEventMap = new Map<number, { courseId: number | null; isRace: boolean; url: string | null }>();
		const adaptivePlanIds = new Set<number>();
		const adaptiveUuidMap = new Map<string, { trainingPlanId: number; workoutUuid: string; sportTypeKey: string | null }>();
		for (const ym of rawCalMonths) {
			const [y, m] = ym.split('/');
			const raw = await garminSafe<any>(['api', `/calendar-service/year/${y}/month/${m}`], null);
			if (raw?.calendarItems) {
				for (const item of raw.calendarItems) {
					if (item.itemType === 'event') {
						rawEventMap.set(item.id, {
							courseId: item.courseId ?? null,
							isRace: item.isRace ?? false,
							url: item.url ?? null,
						});
					} else if (item.itemType === 'fbtAdaptiveWorkout' && item.trainingPlanId && item.workoutUuid) {
						adaptivePlanIds.add(item.trainingPlanId);
						// Key by id|title — coach workouts on the same day share the same id
						const key = `${item.id}|${item.title ?? ''}`;
						adaptiveUuidMap.set(key, {
							trainingPlanId: item.trainingPlanId,
							workoutUuid: item.workoutUuid,
							sportTypeKey: item.sportTypeKey ?? null,
						});
					}
				}
			}
		}

		// Fetch adaptive training plan details
		type AdaptiveTask = { workoutDescription: string | null; estimatedDistanceInMeters: number | null; estimatedDurationInSecs: number | null; trainingEffectLabel: string | null; sportTypeKey: string | null };
		const adaptiveTaskMap = new Map<string, AdaptiveTask>();
		for (const planId of adaptivePlanIds) {
			const plan = await garminSafe<any>(['api', `/trainingplan-service/trainingplan/fbt-adaptive/${planId}`], null);
			if (plan?.taskList) {
				for (const task of plan.taskList) {
					const tw = task.taskWorkout;
					if (tw?.workoutUuid) {
						adaptiveTaskMap.set(tw.workoutUuid, {
							workoutDescription: tw.workoutDescription ?? null,
							estimatedDistanceInMeters: tw.estimatedDistanceInMeters ?? null,
							estimatedDurationInSecs: tw.estimatedDurationInSecs ?? null,
							trainingEffectLabel: tw.trainingEffectLabel ?? null,
							sportTypeKey: tw.sportType?.sportTypeKey ?? null,
						});
					}
				}
			}
		}

		// Fetch coach workout details (workoutPhrase, predicted TE)
		type CoachDetail = { workoutPhrase: string | null; estimatedTrainingEffect: number | null; estimatedAnaerobicTrainingEffect: number | null; steps: WorkoutStep[] };
		const coachDetailMap = new Map<string, CoachDetail>();
		if (adaptiveUuidMap.size > 0) {
			const coachWorkouts = await garminSafe<any[]>(['api', '/workout-service/fbt-adaptive'], []);
			if (Array.isArray(coachWorkouts)) {
				for (const cw of coachWorkouts) {
					const uuid = cw.workoutUuid;
					if (uuid) {
						coachDetailMap.set(uuid, {
							workoutPhrase: cw.workoutPhrase ?? null,
							estimatedTrainingEffect: cw.estimatedTrainingEffect ?? null,
							estimatedAnaerobicTrainingEffect: cw.estimatedAnaerobicTrainingEffect ?? null,
							steps: parseWorkoutSteps(cw),
						});
					}
				}
			}
		}

		for (const ci of calendarItems) {
			if (!ci.title || !ci.date) continue;
			const raw = ci.workout_id != null ? workoutRawMap.get(ci.workout_id) : null;
			const eventData = rawEventMap.get(ci.id);
			const adaptiveInfo = adaptiveUuidMap.get(`${ci.id}|${ci.title ?? ''}`);
			const adaptiveTask = adaptiveInfo ? adaptiveTaskMap.get(adaptiveInfo.workoutUuid) : null;
			const coachDetail = adaptiveInfo ? coachDetailMap.get(adaptiveInfo.workoutUuid) : null;
			// Coach workouts: prefer steps from fbt-adaptive API (has instruction targets), fall back to workout-service
			const steps = coachDetail?.steps?.length
				? coachDetail.steps
				: ci.workout_id != null ? (workoutStepsMap.get(ci.workout_id) ?? []) : [];
			calendarEntries.push({
				id: ci.id,
				item_type: ci.item_type,
				sport_type: raw?.sportType?.sportTypeKey ?? adaptiveTask?.sportTypeKey ?? adaptiveInfo?.sportTypeKey ?? null,
				title: ci.title,
				date: ci.date,
				workout_id: ci.workout_id,
				workout_uuid: adaptiveInfo?.workoutUuid ?? null,
				course_id: eventData?.courseId ?? null,
				is_race: eventData?.isRace ?? false,
				url: eventData?.url ?? null,
				steps,
				workout_description: adaptiveTask?.workoutDescription ?? null,
				estimated_distance_meters: adaptiveTask?.estimatedDistanceInMeters ?? raw?.estimatedDistanceInMeters ?? null,
				estimated_duration_secs: adaptiveTask?.estimatedDurationInSecs ?? raw?.estimatedDurationInSecs ?? null,
				training_effect_label: adaptiveTask?.trainingEffectLabel ?? null,
				workout_phrase: coachDetail?.workoutPhrase ?? null,
				estimated_training_effect: coachDetail?.estimatedTrainingEffect ?? null,
				estimated_anaerobic_training_effect: coachDetail?.estimatedAnaerobicTrainingEffect ?? null,
			});
		}

		upsertSnapshot.run('calendar', JSON.stringify(calendarEntries));

		// Finish
		db.prepare('UPDATE sync_log SET finished_at = ?, status = ? WHERE id = ?')
			.run(new Date().toISOString(), 'ok', logId);

		return {
			status: 'ok',
			duration_ms: Date.now() - start,
			counts: {
				status_days: statusHistory.length,
				hrv_days: hrvHistory.length,
				hr_days: heartRateHistory.length,
				sleep_days: sleepScoreHistory.filter(s => s.score).length,
				stress_days: stressHistory.length,
				hill_days: hillScoreHistory.length,
				endurance_days: enduranceScoreHistory.length,
				activities: activities.length,
				splits: totalSplits,
				weather: totalWeather,
				courses: courseList.length,
			},
		};
	} catch (err: any) {
		db.prepare('UPDATE sync_log SET finished_at = ?, status = ?, error = ? WHERE id = ?')
			.run(new Date().toISOString(), 'error', err.message, logId);

		return {
			status: 'error',
			duration_ms: Date.now() - start,
			error: err.message,
			counts: { status_days: 0, hrv_days: 0, hr_days: 0, sleep_days: 0, stress_days: 0, hill_days: 0, endurance_days: 0, activities: 0, splits: 0, weather: 0, courses: 0 },
		};
	}
}

// ---------------------------------------------------------------------------
// Activity detail extraction (cached derivations from raw)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Calendar / workout parsing
// ---------------------------------------------------------------------------

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
