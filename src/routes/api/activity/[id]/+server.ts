import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garmin, garminSafe } from '$lib/garmin.js';
import { getDb } from '$lib/db.js';

/** GET /api/activity/[id] — fetch description from Garmin API (lazy) */
export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	const raw = await garminSafe<any>(['api', `/activity-service/activity/${id}`], null);
	if (!raw) return error(404, 'Activity not found');
	return json({
		name: raw.activityName ?? raw.name ?? '',
		description: raw.description ?? '',
	});
};

/** PUT /api/activity/[id] — update name + description on Garmin + local DB */
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = params.id;
	const body = await request.json();
	const { name, description } = body as { name?: string; description?: string };

	// Build the update payload — only include fields that were provided
	const payload: Record<string, any> = { activityId: Number(id) };
	if (name !== undefined) payload.activityName = name;
	if (description !== undefined) payload.description = description;

	try {
		await garmin(['api', '--method', 'PUT', '--data', JSON.stringify(payload), `/activity-service/activity/${id}`]);
	} catch (err: any) {
		return error(500, `Garmin API error: ${err.message}`);
	}

	// Update local DB activity blob if name changed
	if (name !== undefined) {
		const db = getDb();
		const row = db.prepare('SELECT data FROM activities WHERE id = ?').get(Number(id)) as { data: string } | undefined;
		if (row) {
			const activity = JSON.parse(row.data);
			activity.name = name;
			db.prepare('UPDATE activities SET data = ? WHERE id = ?').run(JSON.stringify(activity), Number(id));
		}
	}

	return json({ ok: true });
};
