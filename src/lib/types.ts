// --- Training Status (from `training status --days N`) ---

export interface DailyTrainingStatus {
	date: string;
	since_date: string;
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

// --- HR Zones ---

export interface HrZone {
	zone: number;
	min_bpm: number;
	max_bpm: number;
}

// --- Readiness ---

export interface ReadinessEntry {
	timestamp_local?: string;
	score: number;
	level: string;
	feedback: string;
	recovery_time_minutes: number;
	hrv_weekly_average: number;
	hrv_score: number;
	hrv_feedback: string;
	sleep_history_score: number;
	sleep_history_feedback: string;
	sleep_score: number;
	sleep_feedback: string;
	recovery_score: number;
	recovery_feedback: string;
	acwr_score: number;
	acwr_feedback: string;
	stress_score: number;
	stress_feedback: string;
}

export interface Readiness {
	date: string;
	morning: ReadinessEntry | null;
	post_activity: ReadinessEntry | null;
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

export interface UserSettings {
	birth_date: string;
	gender: string;
	height_cm: number;
	weight_kg: number;
	lactate_threshold_hr: number;
	vo2max_running: number;
	sleep_time: string;
	wake_time: string;
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

// --- Activity Weather ---

export interface ActivityWeather {
	temperature_celsius: number;
	feels_like_celsius: number;
	humidity_percent: number;
	wind_speed_kmh: number;
	wind_direction_compass: string;
	weather_description: string;
}

// --- Activities ---

export interface Activity {
	id: number;
	name: string;
	activity_type: string;
	start_time: string;
	distance_meters: number;
	duration_seconds: number;
	moving_duration: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	calories: number | null;
	pace_min_km: string | null;
	avg_pace: string | null;
	training_effect_label: string | null;
	activity_training_load: number | null;
	aerobic_training_effect: number | null;
	anaerobic_training_effect: number | null;
	aerobic_training_effect_message: string | null;
	anaerobic_training_effect_message: string | null;
	elevation_gain: number | null;
	elevation_loss: number | null;
	avg_power: number | null;
	max_power: number | null;
	norm_power: number | null;
	avg_stride_length: number | null;
	avg_ground_contact_time: number | null;
	avg_vertical_oscillation: number | null;
	avg_vertical_ratio: number | null;
	hr_time_in_zone_1: number | null;
	hr_time_in_zone_2: number | null;
	hr_time_in_zone_3: number | null;
	hr_time_in_zone_4: number | null;
	hr_time_in_zone_5: number | null;
	power_time_in_zone_1: number | null;
	power_time_in_zone_2: number | null;
	power_time_in_zone_3: number | null;
	power_time_in_zone_4: number | null;
	power_time_in_zone_5: number | null;
	difference_body_battery: number | null;
	location_name: string | null;
	vo2max_value: number | null;
	avg_grade_adjusted_speed: number | null;
	fastest_split_1000: number | null;
	fastest_split_1609: number | null;
	fastest_split_5000: number | null;
	start_latitude: number | null;
	start_longitude: number | null;
	steps: number | null;
	moderate_intensity_minutes: number | null;
	vigorous_intensity_minutes: number | null;
	workout_id: number | null;
}

export interface ActivitySplit {
	split: number;
	pace: string;
	pace_seconds?: number;
	avg_hr: number;
	max_hr: number | null;
	elevation_gain: number;
	elevation_loss: number;
	avg_power: number;
	norm_power: number | null;
	avg_cadence: number;
	avg_ground_contact_time: number | null;
	avg_stride_length: number | null;
	avg_vertical_oscillation: number | null;
	avg_vertical_ratio: number | null;
	distance_meters: number;
	duration_seconds: number;
	moving_duration_seconds: number | null;
	calories: number | null;
}

// --- Activity Details (time-series + polyline) ---

export interface ActivityDetailPoint {
	dist: number;       // cumulative distance in meters
	hr: number | null;
	pace: number | null; // seconds per km (derived from speed)
	elev: number | null; // elevation in meters
	power: number | null;
	cadence: number | null;
	gap: number | null;  // grade adjusted pace seconds/km
	lat: number | null;
	lon: number | null;
}

export interface ActivityDetails {
	polyline: [number, number][]; // [lat, lon][]
	timeseries: ActivityDetailPoint[];
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
	userSettings: UserSettings | null;
	stress: StressDay;
	bodyBattery: BodyBattery;

	// Trends
	statusHistory: DailyTrainingStatus[];
	hrvHistory: HrvDay[];
	heartRateHistory: HeartRateDay[];
	sleepScoreHistory: SleepScoreDay[];
	stressHistory: StressDay[];
	hillScoreHistory: HillScore[];
	enduranceScoreHistory: EnduranceScore[];

	// Activities
	activities: Activity[];
	recentSplits: Record<number, ActivitySplit[]>; // activity_id -> splits
	activityDetails: Record<number, ActivityDetails>; // activity_id -> details
	activityWeather: Record<number, ActivityWeather>; // activity_id -> weather

	// Records & gear
	records: PersonalRecord[];
	gear: GearItem[];

	// Calendar
	calendar: CalendarEntry[];

	// HR Zones
	hrZones: HrZone[];

	// Computed
	lastRunDate: string | null;
	daysSinceLastRun: number | null;
	lastSyncedAt: string | null;
}
