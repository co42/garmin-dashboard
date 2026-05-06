import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db.js';
import type { CoachWorkout } from '$lib/types.js';
import { buildCreateBodyFromCoach } from '$lib/workout-create.js';
import { createWorkout } from '$lib/garmin-workout.js';
import { refreshWorkouts } from '$lib/sync.js';

/// Copy a coach workout into the user's workout library. Reads the coach
/// workout from the local snapshot (already mapped into our flat shape),
/// strips coach-specific metadata, and creates a fresh user workout via the
/// CLI. The original coach workout stays in place — only a copy is made.
export const POST: RequestHandler = async ({ params, request }) => {
	const uuid = params.uuid;
	if (!uuid) throw error(400, 'missing uuid');

	const row = getDb()
		.prepare('SELECT data FROM snapshots WHERE command = ?')
		.get('coach_workouts') as { data: string } | undefined;
	if (!row) throw error(404, 'coach workouts snapshot not found — run sync first');

	const coachWorkouts: CoachWorkout[] = JSON.parse(row.data);
	const coach = coachWorkouts.find(w => w.workout_uuid === uuid);
	if (!coach) throw error(404, `coach workout ${uuid} not found`);

	// Optional name override from body (e.g. user renames during copy).
	const body = await request.json().catch(() => null);
	const nameOverride = typeof body?.name === 'string' && body.name.trim() !== ''
		? body.name.trim()
		: undefined;

	const garminBody = buildCreateBodyFromCoach(coach, nameOverride);

	let result: unknown;
	try {
		result = await createWorkout(garminBody);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(502, `Garmin create failed: ${msg}`);
	}

	await refreshWorkouts();
	return json({ ok: true, result });
};
