// Server-side helpers for invoking `garmin workouts create/update` — these
// commands take a JSON body via `--file <path>`, so we write a tempfile,
// run the CLI, and clean up on the way out.

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function runWithJsonFile(args: string[], body: unknown): Promise<unknown> {
	const dir = mkdtempSync(path.join(tmpdir(), 'gd-workout-'));
	const file = path.join(dir, 'workout.json');
	writeFileSync(file, JSON.stringify(body), 'utf8');
	try {
		const { stdout } = await exec(
			'garmin',
			[...args, '--file', file, '--json'],
			{ timeout: 30000, env: { ...process.env, NO_COLOR: '1' } },
		);
		return stdout ? JSON.parse(stdout) : null;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

export function createWorkout(body: unknown): Promise<unknown> {
	return runWithJsonFile(['workouts', 'create'], body);
}

export function updateWorkout(id: number, body: unknown): Promise<unknown> {
	return runWithJsonFile(['workouts', 'update', String(id)], body);
}
