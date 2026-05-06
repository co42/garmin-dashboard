import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildCreateBody } from '$lib/workout-create.js';
import { createWorkout } from '$lib/garmin-workout.js';
import { refreshWorkouts } from '$lib/sync.js';
import type { WorkoutStep } from '$lib/types.js';

interface CreateBody {
	workout_name: string;
	description?: string | null;
	sport_type?: string | null;
	steps: WorkoutStep[];
}

function validate(body: unknown): CreateBody {
	if (!body || typeof body !== 'object') throw error(400, 'body must be an object');
	const b = body as Record<string, unknown>;
	if (typeof b.workout_name !== 'string' || b.workout_name.trim() === '') {
		throw error(400, 'workout_name is required');
	}
	if (!Array.isArray(b.steps)) throw error(400, 'steps must be an array');
	return b as unknown as CreateBody;
}

/// Create a new user workout. Body is the flat dashboard shape; the route
/// reshapes it into Garmin's nested camelCase create body, hands it to the
/// CLI, and refreshes the workouts snapshot before returning.
export const POST: RequestHandler = async ({ request }) => {
	const body = validate(await request.json().catch(() => null));
	const garminBody = buildCreateBody(body);

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
