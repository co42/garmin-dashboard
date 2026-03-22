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

		// Phase 5: Fetch splits for new activities (parallel, batched)
		const upsertSplit = db.prepare(
			`INSERT INTO activity_splits (activity_id, split, data) VALUES (?, ?, ?)
			 ON CONFLICT(activity_id, split) DO UPDATE SET data = excluded.data`
		);

		// Fetch splits in batches of 5 to avoid overwhelming the API
		let totalSplits = 0;
		for (let i = 0; i < newActivityIds.length; i += 5) {
			const batch = newActivityIds.slice(i, i + 5);
			const results = await Promise.all(
				batch.map(id =>
					garminSafe<ActivitySplit[]>(['activities', 'splits', String(id)], [])
						.then(splits => ({ id, splits }))
				)
			);

			const splitBatch = db.transaction(() => {
				for (const { id, splits } of results) {
					for (const s of splits) {
						upsertSplit.run(id, s.split, JSON.stringify(s));
						totalSplits++;
					}
				}
			});
			splitBatch();
		}

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
