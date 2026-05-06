// Server-side mappers that convert our flat `Workout` shape (snake_case,
// flattened) into the nested camelCase body Garmin's `workouts create` /
// `workouts update` endpoints expect. Mirrors the structure from
// `garmin-cli`'s `workouts template` output.
//
// Garmin's API uses tagged objects ({ stepTypeId, stepTypeKey }, etc.) for the
// step / condition / target / sport vocabulary. The IDs are well-known
// constants — we hardcode them here rather than calling Garmin's lookup endpoint.

import type { Workout, CoachWorkout, WorkoutStep } from './types.js';

const STEP_TYPE_IDS: Record<string, number> = {
	warmup: 1,
	cooldown: 2,
	interval: 3,
	recovery: 4,
	rest: 5,
	other: 7,
};

const CONDITION_TYPE_IDS: Record<string, number> = {
	'lap.button': 1,
	time: 2,
	distance: 3,
	calories: 4,
	'heart.rate': 5,
	power: 6,
	iterations: 7,
};

const TARGET_TYPE_IDS: Record<string, number> = {
	'no.target': 1,
	'power.zone': 2,
	'cadence.zone': 3,
	'heart.rate.zone': 4,
	'speed.zone': 5,
	'pace.zone': 6,
};

const SPORT_TYPE_IDS: Record<string, number> = {
	running: 1,
	cycling: 2,
	other: 4,
	strength_training: 5,
	cardio_training: 6,
};

function sportTypeRef(key: string | null): { sportTypeId: number; sportTypeKey: string } {
	const k = key ?? 'running';
	return { sportTypeId: SPORT_TYPE_IDS[k] ?? SPORT_TYPE_IDS.running, sportTypeKey: k };
}

function buildStep(step: WorkoutStep, order: number): Record<string, unknown> {
	if (step.type === 'RepeatGroupDTO') {
		return {
			type: 'RepeatGroupDTO',
			stepOrder: order,
			numberOfIterations: step.number_of_iterations ?? 1,
			workoutSteps: (step.steps ?? []).map((s, i) => buildStep(s, i + 1)),
		};
	}

	const out: Record<string, unknown> = {
		type: 'ExecutableStepDTO',
		stepOrder: order,
		stepType: {
			stepTypeId: STEP_TYPE_IDS[step.step_type] ?? STEP_TYPE_IDS.other,
			stepTypeKey: step.step_type,
		},
		endCondition: {
			conditionTypeId: CONDITION_TYPE_IDS[step.end_condition] ?? CONDITION_TYPE_IDS['lap.button'],
			conditionTypeKey: step.end_condition,
		},
		endConditionValue: step.end_condition_value,
	};

	if (step.target_type && step.target_type !== 'no.target') {
		out.targetType = {
			workoutTargetTypeId: TARGET_TYPE_IDS[step.target_type] ?? TARGET_TYPE_IDS['no.target'],
			workoutTargetTypeKey: step.target_type,
		};
		if (step.target_value_one != null) out.targetValueOne = step.target_value_one;
		if (step.target_value_two != null) out.targetValueTwo = step.target_value_two;
	}

	if (step.description) out.description = step.description;

	return out;
}

/// Turn a flat `Workout` (or partial — `workout_id` and dates ignored) into
/// the nested body that `garmin workouts create|update --file <tmp>` reads.
export function buildCreateBody(input: {
	workout_name: string;
	description?: string | null;
	sport_type?: string | null;
	steps: WorkoutStep[];
}): Record<string, unknown> {
	const sport = sportTypeRef(input.sport_type ?? 'running');
	return {
		workoutName: input.workout_name,
		description: input.description ?? null,
		sportType: sport,
		workoutSegments: [
			{
				segmentOrder: 1,
				sportType: sport,
				workoutSteps: input.steps.map((s, i) => buildStep(s, i + 1)),
			},
		],
	};
}

/// Build a create body from a coach workout. Drops coach-specific metadata
/// (priority, training plan, training-effect labels) — those are Garmin
/// adaptive-plan annotations and aren't accepted on user-workout create.
export function buildCreateBodyFromCoach(coach: CoachWorkout, nameOverride?: string): Record<string, unknown> {
	return buildCreateBody({
		workout_name: nameOverride ?? coach.workout_name,
		description: coach.description,
		sport_type: coach.sport_type,
		steps: coach.steps,
	});
}

/// Promote a `Workout` into `buildCreateBody`'s input shape (for re-saving an
/// edited existing workout).
export function buildCreateBodyFromWorkout(w: Workout): Record<string, unknown> {
	return buildCreateBody({
		workout_name: w.workout_name,
		description: w.description,
		sport_type: w.sport_type,
		steps: w.steps,
	});
}
