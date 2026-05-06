import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garmin } from '$lib/garmin.js';
import { refreshCalendar } from '$lib/sync.js';

/// Remove a scheduled workout (or any calendar entry) from Garmin's
/// calendar. `id` is the calendar entry id (not the workout id). Routes
/// through `garmin calendar delete`, then refreshes the calendar snapshot.
export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid calendar entry id');

	try {
		await garmin<unknown>(['calendar', 'delete', String(id)]);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(502, `Garmin delete failed: ${msg}`);
	}

	await refreshCalendar();
	return json({ ok: true, calendarEntryId: id });
};
