import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garmin } from '$lib/garmin.js';
import { refreshEventsAndProjections } from '$lib/sync.js';

const ALLOWED_PRIORITIES = new Set(['primary', 'secondary', 'none']);

/// Update an event's priority. Body: `{ priority: 'primary' | 'secondary' | 'none' }`.
/// Routes through `garmin calendar events update`, which fetches the event,
/// mutates eventCustomization.{isPrimaryEvent,isTrainingEvent}, and PUTs the
/// full body back. After the upstream change we re-pull the events snapshot +
/// projection histories so the dashboard reflects Garmin's new state.
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid event id');

	const body = await request.json().catch(() => null);
	const priority = body?.priority;
	if (typeof priority !== 'string' || !ALLOWED_PRIORITIES.has(priority)) {
		throw error(400, "body must be { priority: 'primary' | 'secondary' | 'none' }");
	}

	try {
		await garmin<unknown>(['calendar', 'events', 'update', String(id), '--priority', priority]);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(502, `Garmin update failed: ${msg}`);
	}

	await refreshEventsAndProjections();
	return json({ ok: true, eventId: id, priority });
};

/// Delete an event from Garmin. Cascades to removing its projection rows
/// from the local DB.
export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid event id');

	try {
		await garmin<unknown>(['calendar', 'events', 'delete', String(id)]);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(502, `Garmin delete failed: ${msg}`);
	}

	await refreshEventsAndProjections();
	return json({ ok: true, eventId: id });
};
