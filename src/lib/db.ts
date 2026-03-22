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

CREATE TABLE IF NOT EXISTS daily_status (
	date TEXT PRIMARY KEY,
	data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_hrv (
	date TEXT PRIMARY KEY,
	status TEXT,
	weekly_average REAL
);

CREATE TABLE IF NOT EXISTS daily_heart_rate (
	date TEXT PRIMARY KEY,
	resting_hr INTEGER,
	avg_7day_resting INTEGER,
	max_hr INTEGER,
	min_hr INTEGER
);

CREATE TABLE IF NOT EXISTS daily_sleep_score (
	date TEXT PRIMARY KEY,
	score INTEGER
);

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

CREATE TABLE IF NOT EXISTS weekly_hill_score (
	date TEXT PRIMARY KEY,
	overall INTEGER,
	strength INTEGER,
	endurance INTEGER
);

CREATE TABLE IF NOT EXISTS weekly_endurance_score (
	date TEXT PRIMARY KEY,
	score INTEGER,
	classification TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	started_at TEXT NOT NULL DEFAULT (datetime('now')),
	finished_at TEXT,
	status TEXT DEFAULT 'running',
	error TEXT
);
`;
