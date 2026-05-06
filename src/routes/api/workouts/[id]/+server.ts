import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garmin } from '$lib/garmin.js';
import { buildCreateBody } from '$lib/workout-create.js';
import { updateWorkout } from '$lib/garmin-workout.js';
import { refreshWorkouts } from '$lib/sync.js';
import type { WorkoutStep } from '$lib/types.js';

interface UpdateBody {
	workout_name: string;
	description?: string | null;
	sport_type?: string | null;
	steps: WorkoutStep[];
}

function validate(body: unknown): UpdateBody {
	if (!body || typeof body !== 'object') throw error(400, 'body must be an object');
	const b = body as Record<string, unknown>;
	if (typeof b.workout_name !== 'string' || b.workout_name.trim() === '') {
		throw error(400, 'workout_name is required');
	}
	if (!Array.isArray(b.steps)) throw error(400, 'steps must be an array');
	return b as unknown as UpdateBody;
}

/// Update an existing user workout. Same body shape as create.
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid workout id');

	const body = validate(await request.json().catch(() => null));
	const garminBody = buildCreateBody(body);

	try {
		await updateWorkout(id, garminBody);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(502, `Garmin update failed: ${msg}`);
	}

	await refreshWorkouts();
	return json({ ok: true, workoutId: id });
};

/// Delete a workout from Garmin and refresh the snapshot so it disappears
/// from the dashboard immediately.
export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid workout id');

	try {
		await garmin<unknown>(['workouts', 'delete', String(id)]);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(502, `Garmin delete failed: ${msg}`);
	}

	await refreshWorkouts();
	return json({ ok: true, workoutId: id });
};
