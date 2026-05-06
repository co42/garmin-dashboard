<script lang="ts">
	import type { CoachWorkout } from '$lib/types.js';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import CoachWorkoutRow from './CoachWorkoutRow.svelte';
	import CoachWorkoutDetails from './CoachWorkoutDetails.svelte';
	import WorkoutEditorModal from './WorkoutEditorModal.svelte';

	interface Props {
		coachWorkouts: CoachWorkout[];
		oncopied?: () => void;
	}

	let { coachWorkouts, oncopied }: Props = $props();

	let expandedUuid = $state<string | null>(null);
	let editorOpen = $state(false);
	let prefill = $state<{ workout_name: string; description: string | null; sport_type: string | null; steps: CoachWorkout['steps'] } | null>(null);

	function toggleExpand(uuid: string) {
		expandedUuid = expandedUuid === uuid ? null : uuid;
	}

	// Instead of one-shot POST /api/workouts/from-coach: open the editor
	// pre-filled with the coach workout's data, let the user save as-is or
	// modify first. Save goes through the normal POST /api/workouts path.
	function copyWorkout(workout: CoachWorkout) {
		prefill = {
			workout_name: workout.workout_name,
			description: workout.description,
			sport_type: workout.sport_type,
			steps: workout.steps,
		};
		editorOpen = true;
	}

	async function onSaved() {
		toast.success('Workout saved');
		editorOpen = false;
		await invalidateAll();
		oncopied?.();
	}
</script>

<div class="space-y-2">
	{#each coachWorkouts as workout (workout.workout_uuid)}
		<div id="coach-workout-{workout.workout_uuid}" class="rounded-lg bg-card">
			<CoachWorkoutRow
				{workout}
				expanded={expandedUuid === workout.workout_uuid}
				ontoggle={() => toggleExpand(workout.workout_uuid)}
				oncopy={() => copyWorkout(workout)}
			/>
			{#if expandedUuid === workout.workout_uuid}
				<CoachWorkoutDetails {workout} />
			{/if}
		</div>
	{/each}

	{#if coachWorkouts.length === 0}
		<div class="rounded-lg bg-card px-4 py-6 text-center text-xs text-text-dim">
			No coach workouts — sign up for a Garmin Coach plan to see adaptive workouts here.
		</div>
	{/if}
</div>

<WorkoutEditorModal
	{prefill}
	open={editorOpen}
	onClose={() => editorOpen = false}
	{onSaved}
/>
