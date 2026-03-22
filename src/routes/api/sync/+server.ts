import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runSync } from '$lib/sync.js';

export const POST: RequestHandler = async () => {
	const result = await runSync();
	return json(result, { status: result.status === 'ok' ? 200 : 500 });
};
