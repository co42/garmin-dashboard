import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.cwd(), 'data/training.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (_db) return _db;

	_db = new Database(DB_PATH);
	_db.pragma('journal_mode = WAL');
	_db.pragma('foreign_keys = ON');
	_db.exec(SCHEMA);
	return _db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
	command TEXT PRIMARY KEY,
	data TEXT NOT NULL,
	synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily time-series (all JSON blobs)
CREATE TABLE IF NOT EXISTS daily_training_status (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_hrv (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_heart_rate (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_sleep_score (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stress (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_hill_score (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_endurance_score (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
	id INTEGER PRIMARY KEY,
	data TEXT NOT NULL,
	synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_splits (
	activity_id INTEGER NOT NULL,
	split INTEGER NOT NULL,
	data TEXT NOT NULL,
	PRIMARY KEY (activity_id, split)
);

CREATE TABLE IF NOT EXISTS activity_details (
	activity_id INTEGER PRIMARY KEY,
	raw TEXT NOT NULL,
	polyline TEXT,
	timeseries TEXT,
	metric_keys TEXT
);

CREATE TABLE IF NOT EXISTS activity_weather (
	activity_id INTEGER PRIMARY KEY,
	data TEXT NOT NULL
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
	id INTEGER PRIMARY KEY,
	data TEXT NOT NULL,
	geo_points TEXT,
	synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	started_at TEXT NOT NULL DEFAULT (datetime('now')),
	finished_at TEXT,
	status TEXT DEFAULT 'running',
	error TEXT
);
`;
