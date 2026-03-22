import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function garmin<T>(args: string[]): Promise<T> {
	const { stdout } = await exec('garmin', [...args, '--json'], {
		timeout: 30000,
		env: { ...process.env, NO_COLOR: '1' },
	});
	return JSON.parse(stdout) as T;
}

export async function garminSafe<T>(args: string[], fallback: T): Promise<T> {
	try {
		return await garmin<T>(args);
	} catch {
		return fallback;
	}
}
