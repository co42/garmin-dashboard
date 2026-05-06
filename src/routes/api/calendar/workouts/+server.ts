import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garmin } from '$lib/garmin.js';
import { refreshCalendar } from '$lib/sync.js';

/// Schedule a user workout on a specific date. Body: `{ workout_id: number,
/// date: 'YYYY-MM-DD' }`. Routes through `garmin workouts schedule`, which
/// adds an entry to Garmin's calendar; we then refresh the local calendar
/// snapshot so the UI reflects the new entry without a full sync.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const workoutId = Number(body?.workout_id);
	const date = body?.date;

	if (!Number.isFinite(workoutId)) throw error(400, 'workout_id (number) is required');
	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw error(400, 'date (YYYY-MM-DD) is required');
	}

	try {
		await garmin<unknown>(['workouts', 'schedule', String(workoutId), date]);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(502, `Garmin schedule failed: ${msg}`);
	}

	await refreshCalendar();
	return json({ ok: true, workoutId, date });
};
