import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runSync } from '$lib/sync.js';

export const POST: RequestHandler = async ({ url }) => {
	const full = url.searchParams.get('full') === '1';
	const result = await runSync(full);
	return json(result, { status: result.status === 'ok' ? 200 : 500 });
};
