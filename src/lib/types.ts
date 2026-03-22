// --- Training Status (from `training status --days N`) ---

export interface DailyTrainingStatus {
	date: string;
	acwr: number;
	acwr_status: string;
	acute_load: number;
	chronic_load: number;
	status: string; // "PRODUCTIVE_2", "DETRAINING", "MAINTAINING", etc.
	status_code: number;
	fitness_trend: number;
	fitness_trend_sport: string;
	load_balance_feedback: string;
	monthly_load_aerobic_high: number;
	monthly_load_aerobic_high_target_max: number;
	monthly_load_aerobic_high_target_min: number;
	monthly_load_aerobic_low: number;
	monthly_load_aerobic_low_target_max: number;
	monthly_load_aerobic_low_target_min: number;
	monthly_load_anaerobic: number;
	monthly_load_anaerobic_target_max: number;
	monthly_load_anaerobic_target_min: number;
	vo2max: number;
	vo2max_precise: number;
	vo2max_date: string;
	training_paused: boolean;
}

// --- Readiness ---

export interface Readiness {
	score: number;
	level: string;
	date: string;
	hrv_score: number;
	hrv_feedback: string;
	hrv_weekly_average: number;
	sleep_history_score: number;
	sleep_history_feedback: string;
	recovery_score: number;
	recovery_feedback: string;
	stress_score: number;
	stress_feedback: string;
	acwr_score: number;
	acwr_feedback: string;
	recovery_time_minutes: number;
	feedback: string;
	sleep_score: number;
	sleep_feedback: string;
}

// --- Race Predictions ---

export interface RacePredictions {
	date: string;
	time_5k_seconds: number;
	time_10k_seconds: number;
	time_half_marathon_seconds: number;
	time_marathon_seconds: number;
	pace_5k: string;
	pace_10k: string;
	pace_half_marathon: string;
	pace_marathon: string;
}

// --- Endurance Score ---

export interface EnduranceScore {
	score: number;
	classification: string;
	date: string;
}

// --- Hill Score ---

export interface HillScore {
	date: string;
	overall: number;
	strength: number;
	endurance: number;
	vo2max: number;
}

// --- Fitness Age ---

export interface FitnessAge {
	fitness_age: number;
	chronological_age: number;
	achievable_fitness_age: number;
	bmi: number;
	resting_heart_rate: number;
	vigorous_days_avg: number;
	vigorous_minutes_avg: number;
}

// --- Lactate Threshold ---

export interface LactateThreshold {
	date: string;
	heart_rate: number;
	pace: string;
	speed_meters_per_second: number;
}

// --- HRV ---

export interface HrvDay {
	date: string;
	status: string;
	weekly_average: number;
}

// --- Health ---

export interface HeartRateDay {
	date: string;
	resting_hr: number;
	avg_7day_resting: number;
	max_hr: number;
	min_hr: number;
}

export interface SleepScoreDay {
	date: string;
	score: number;
}

export interface StressDay {
	date: string;
	avg_stress: number;
	max_stress: number;
	body_battery_high: number;
	body_battery_low: number;
	body_battery_latest: number;
}

export interface BodyBattery {
	date: string;
	high: number;
	low: number;
	latest: number;
}

// --- Activities ---

export interface Activity {
	id: number;
	name: string;
	activity_type: string;
	start_time: string;
	distance_meters: number;
	duration_seconds: number;
	avg_hr: number | null;
	max_hr: number | null;
	calories: number | null;
	pace_min_km: string | null;
	training_effect_label: string | null;
	activity_training_load: number | null;
	aerobic_training_effect: number | null;
	anaerobic_training_effect: number | null;
	elevation_gain: number | null;
	elevation_loss: number | null;
	avg_power: number | null;
	avg_stride_length: number | null;
	avg_ground_contact_time: number | null;
	avg_vertical_oscillation: number | null;
	avg_vertical_ratio: number | null;
	hr_time_in_zone_1: number | null;
	hr_time_in_zone_2: number | null;
	hr_time_in_zone_3: number | null;
	hr_time_in_zone_4: number | null;
	hr_time_in_zone_5: number | null;
	difference_body_battery: number | null;
	location_name: string | null;
	vo2max_value: number | null;
	avg_grade_adjusted_speed: number | null;
}

export interface ActivitySplit {
	split: number;
	pace: string;
	pace_seconds?: number;
	avg_hr: number;
	elevation_gain: number;
	elevation_loss: number;
	avg_power: number;
	avg_cadence: number;
	distance_meters: number;
	duration_seconds: number;
}

// --- Records ---

export interface PersonalRecord {
	type_id: number;
	value: number;
	date: string;
	activity_id: number;
	activity_name: string;
	activity_type: string;
}

// --- Gear ---

export interface GearItem {
	uuid: string;
	display_name: string;
	type: string;
	distance_meters: number;
	activities: number;
	date_begin: string | null;
	date_end: string | null;
	active: boolean;
}

// --- Calendar / Upcoming ---

export interface CalendarItem {
	id: number;
	item_type: string;
	workout_id: number | null;
	title: string | null;
	date: string | null;
}

export interface WorkoutStep {
	type: string;
	step_type: string;
	end_condition: string;
	end_condition_value: number;
	target_type: string | null;
	target_value_one: number | null;
	target_value_two: number | null;
	description: string | null;
	exercise_name: string | null;
	category: string | null;
	number_of_iterations: number | null;
	steps: WorkoutStep[] | null;
}

export interface CalendarEntry {
	id: number;
	item_type: string;
	sport_type: string | null;
	title: string;
	date: string;
	workout_id: number | null;
	steps: WorkoutStep[];
}

// --- Dashboard aggregate ---

export interface DashboardData {
	// Current state
	currentStatus: DailyTrainingStatus;
	readiness: Readiness;
	racePredictions: RacePredictions;
	enduranceScore: EnduranceScore;
	hillScore: HillScore;
	fitnessAge: FitnessAge;
	lactateThreshold: LactateThreshold;
	stress: StressDay;
	bodyBattery: BodyBattery;

	// Trends
	statusHistory: DailyTrainingStatus[];
	hrvHistory: HrvDay[];
	heartRateHistory: HeartRateDay[];
	sleepScoreHistory: SleepScoreDay[];
	hillScoreHistory: HillScore[];
	enduranceScoreHistory: EnduranceScore[];

	// Activities
	activities: Activity[];
	recentSplits: Record<number, ActivitySplit[]>; // activity_id -> splits

	// Records & gear
	records: PersonalRecord[];
	gear: GearItem[];

	// Calendar
	calendar: CalendarEntry[];

	// Computed
	lastRunDate: string | null;
	daysSinceLastRun: number | null;
	lastSyncedAt: string | null;
}
