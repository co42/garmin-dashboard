import { json } from '@sveltejs/kit';
import { getDb } from '$lib/db.js';

export async function PUT({ request }) {
	const { key, value } = await request.json();
	if (typeof key !== 'string' || typeof value !== 'string') {
		return json({ error: 'invalid' }, { status: 400 });
	}
	const db = getDb();
	db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
	return json({ ok: true });
}
