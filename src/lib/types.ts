// --- Training Status (from `training status --days N`) ---

export interface DailyTrainingStatus {
	date: string;
	since_date: string;
	acwr: number;
	acwr_status: string;
	acute_load: number;
	chronic_load: number;
	min_training_load_chronic: number | null;
	max_training_load_chronic: number | null;
	status: string; // "PRODUCTIVE_2", "DETRAINING", "MAINTAINING", etc.
	fitness_trend: string;
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
	vo2max_date: string;
	training_paused: boolean;
}

// --- HR Zones ---

export interface HrZone {
	zone: number;
	min_bpm: number;
	max_bpm: number | null;
}

// --- Readiness ---

export interface ReadinessEntry {
	input_context?: string;
	timestamp_local?: string;
	score: number;
	level: string;
	feedback_short: string;
	recovery_time: number;
	hrv_weekly_average: number;
	hrv_factor_percent: number;
	hrv_factor_feedback: string;
	sleep_history_factor_percent: number;
	sleep_history_factor_feedback: string;
	sleep_score_factor_percent: number;
	sleep_score_factor_feedback: string;
	recovery_time_factor_percent: number;
	recovery_time_factor_feedback: string;
	acwr_factor_percent: number;
	acwr_factor_feedback: string;
	stress_history_factor_percent: number;
	stress_history_factor_feedback: string;
}

export interface Readiness {
	date: string;
	morning: ReadinessEntry | null;
	post_activity: ReadinessEntry | null;
	latest: ReadinessEntry | null;
}

// --- Race Predictions ---

export interface RacePredictions {
	date: string;
	time_5k_seconds: number | null;
	time_10k_seconds: number | null;
	time_half_marathon_seconds: number | null;
	time_marathon_seconds: number | null;
}

// --- Endurance Score ---

export interface EnduranceScore {
	score: number;
	classification: string;
	feedback: string | null;
	date: string;
}

// --- Hill Score ---

export interface HillScore {
	date: string;
	overall_score: number;
	strength_score: number;
	endurance_score: number;
	vo2_max: number;
}

// --- Fitness Age ---

export interface FitnessAge {
	date: string;
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
	speed_mps: number;
}

// --- User Settings ---

export interface UserSettings {
	birth_date: string;
	gender: string;
	handedness: string | null;
	height_cm: number;
	weight_kg: number;
	lactate_threshold_hr_bpm: number;
	lactate_threshold_speed_mps: number;
	threshold_hr_auto_detected: boolean;
	max_hr_bpm: number | null;
	resting_hr_bpm: number | null;
	vo2max_running: number | null;
	vo2max_cycling: number | null;
	ftp_watts: number | null;
	ftp_auto_detected: boolean | null;
	measurement_system: string | null;
	time_format: string | null;
	available_training_days: string[] | null;
	preferred_long_training_days: string[] | null;
	sleep_time: string;
	wake_time: string;
}

// --- HRV ---

export interface HrvDay {
	date: string;
	status: string;
	weekly_average: number;
	last_night_avg: number | null;
	last_night_5min_high: number | null;
	baseline_balanced_low: number | null;
	baseline_balanced_upper: number | null;
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
}

export interface BodyBattery {
	date: string;
	body_battery_high: number;
	body_battery_low: number;
	body_battery_latest: number;
	body_battery_reset_level?: number | null;
	body_battery_reset_timestamp_ms?: number | null;
}

// --- Activity Weather ---

export interface ActivityWeather {
	temperature_celsius: number | null;
	feels_like_celsius: number | null;
	dew_point_celsius: number | null;
	relative_humidity: number | null;
	wind_speed_kmh: number | null;
	wind_gust_kmh: number | null;
	wind_direction_degrees: number | null;
	wind_direction_compass_point: string | null;
	weather_description: string | null;
	station_name: string | null;
	latitude: number | null;
	longitude: number | null;
	timestamp: string | null;
}

// --- Activities ---

export interface Activity {
	activity_id: number;
	activity_name: string;
	activity_type: string;
	start_time_local: string;
	start_time_gmt?: string;
	distance_meters: number;
	duration_seconds: number;
	moving_duration_seconds: number | null;
	elapsed_duration_seconds: number | null;
	average_hr: number | null;
	max_hr: number | null;
	min_hr: number | null;
	calories: number | null;
	bmr_calories: number | null;
	training_effect_label: string | null;
	activity_training_load: number | null;
	aerobic_training_effect: number | null;
	anaerobic_training_effect: number | null;
	aerobic_training_effect_message: string | null;
	anaerobic_training_effect_message: string | null;
	elevation_gain_meters: number | null;
	elevation_loss_meters: number | null;
	min_elevation_meters: number | null;
	max_elevation_meters: number | null;
	avg_elevation_meters: number | null;
	max_power: number | null;
	min_power: number | null;
	norm_power: number | null;
	normalized_power: number | null;
	average_speed_mps: number | null;
	max_speed_mps: number | null;
	average_moving_speed_mps: number | null;
	max_vertical_speed_mps: number | null;
	avg_stride_length_cm: number | null;
	avg_ground_contact_time_ms: number | null;
	avg_vertical_oscillation_cm: number | null;
	avg_vertical_ratio_percent: number | null;
	hr_time_in_zone_1_seconds: number | null;
	hr_time_in_zone_2_seconds: number | null;
	hr_time_in_zone_3_seconds: number | null;
	hr_time_in_zone_4_seconds: number | null;
	hr_time_in_zone_5_seconds: number | null;
	power_time_in_zone_1_seconds: number | null;
	power_time_in_zone_2_seconds: number | null;
	power_time_in_zone_3_seconds: number | null;
	power_time_in_zone_4_seconds: number | null;
	power_time_in_zone_5_seconds: number | null;
	difference_body_battery: number | null;
	location_name: string | null;
	vo2_max_value: number | null;
	avg_grade_adjusted_speed_mps: number | null;
	fastest_split_1000_seconds: number | null;
	fastest_split_1609_seconds: number | null;
	fastest_split_5000_seconds: number | null;
	start_latitude: number | null;
	start_longitude: number | null;
	end_latitude: number | null;
	end_longitude: number | null;
	steps: number | null;
	max_run_cadence: number | null;
	moderate_intensity_minutes: number | null;
	vigorous_intensity_minutes: number | null;
	total_work_joules: number | null;
	impact_load: number | null;
	begin_potential_stamina: number | null;
	end_potential_stamina: number | null;
	min_available_stamina: number | null;
	direct_workout_feel: number | null;
	direct_workout_rpe: number | null;
	direct_workout_compliance_score: number | null;
	workout_id?: number | null;
}

export interface ActivitySplit {
	split: number;
	pace?: string;
	pace_seconds?: number;
	average_hr: number;
	max_hr: number | null;
	elevation_gain_meters: number;
	elevation_loss_meters: number;
	average_power: number | null;
	normalized_power: number | null;
	average_run_cadence: number | null;
	ground_contact_time_ms: number | null;
	stride_length_cm: number | null;
	vertical_oscillation_cm: number | null;
	vertical_ratio_percent: number | null;
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
	record_type: string;
	sport: string;
	value: number;
	formatted_value: string;
	activity_id?: number;
	activity_name?: string;
	activity_type?: string;
	date?: string;
}

// --- Gear ---

export interface GearItem {
	uuid: string;
	display_name: string;
	brand: string;
	gear_type_name: string;
	gear_status_name: string | null;
	distance_meters: number;
	maximum_meters: number;
	activities: number;
	date_begin: string | null;
	date_end: string | null;
}

// --- Courses ---

export interface CourseGeoPoint {
	latitude: number;
	longitude: number;
	elevation_meters: number;
	distance_meters: number;
}

export interface Course {
	course_id: number;
	course_name: string;
	activity_type: { type_key: string } | null;
	distance_meters: number;
	elevation_gain_meters: number;
	elevation_loss_meters: number;
	speed_mps?: number | null;
	has_pace_band: boolean | null;
	created_date: string;
	updated_date?: string | null;
	start_latitude?: number | null;
	start_longitude?: number | null;
	geo_points: CourseGeoPoint[];
}

// --- Coach plan + target event ---

export type TrainingPhaseKind = 'BUILD' | 'PEAK' | 'TAPER' | 'TARGET_EVENT_DAY';

export interface CoachPhase {
	start_date: string;
	end_date: string;
	training_phase: TrainingPhaseKind;
	current_phase: boolean;
}

export interface CoachPlan {
	training_plan_id: number;
	name: string;
	start_date: string;
	end_date: string;
	duration_weeks: number | null;
	avg_weekly_workouts: number | null;
	training_status: string | null;
	training_level: string | null;
	training_version: string | null;
	supplemental_sports: string[];
	phases: CoachPhase[];
}

export interface CoachEvent {
	id: number;
	name: string;
	event_type: string | null;
	date: string;
	start_time_local: string | null;
	timezone: string | null;
	location: string | null;
	distance_meters: number | null;
	goal_seconds: number | null;
	predicted_race_time_seconds: number | null;
	projected_race_time_seconds: number | null;
	is_primary_event: boolean | null;
	training_plan_id: number | null;
}

export interface EventProjection {
	date: string;
	predicted_race_time_seconds: number | null;
	projection_race_time_seconds: number | null;
	upper_bound_projection_race_time_seconds: number | null;
	lower_bound_projection_race_time_seconds: number | null;
	feedback_phrase: string | null;
}

// --- Calendar / Upcoming ---

export interface CalendarItem {
	id: number;
	item_type: string;
	workout_id: number | null;
	workout_uuid?: string | null;
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
	workout_uuid: string | null;
	course_id: number | null;
	is_race: boolean;
	url: string | null;
	steps: WorkoutStep[];
	// Adaptive workout (Garmin Coach) fields
	workout_description: string | null;
	estimated_distance_meters: number | null;
	estimated_duration_seconds: number | null;
	training_effect_label: string | null;
	workout_phrase: string | null;
	estimated_training_effect: number | null;
	estimated_anaerobic_training_effect: number | null;
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
	racePredictionHistory: RacePredictions[];
	lactateThresholdHistory: LactateThreshold[];

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

	// Coach plan + target event + projection history
	coachPlan: CoachPlan | null;
	coachEvent: CoachEvent | null;
	projectionHistory: EventProjection[];

	// Courses
	courses: Course[];

	// HR Zones
	hrZones: HrZone[];

	// Computed
	lastRunDate: string | null;
	daysSinceLastRun: number | null;
	lastSyncedAt: string | null;
}
