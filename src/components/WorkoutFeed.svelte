<script lang="ts">
	import type { Workout } from '$lib/types.js';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import WorkoutRow from './WorkoutRow.svelte';
	import WorkoutDetails from './WorkoutDetails.svelte';
	import WorkoutEditorModal from './WorkoutEditorModal.svelte';
	import Plus from 'phosphor-svelte/lib/Plus';

	interface Props {
		workouts: Workout[];
	}

	let { workouts }: Props = $props();

	let expandedId = $state<number | null>(null);
	let editing = $state<Workout | null>(null);
	let editorOpen = $state(false);

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	function newWorkout() {
		editing = null;
		editorOpen = true;
	}
	function editWorkout(w: Workout) {
		editing = w;
		editorOpen = true;
	}
	async function deleteWorkout(w: Workout) {
		if (!confirm(`Delete "${w.workout_name}"? This removes it from Garmin and can't be undone.`)) return;
		try {
			const res = await fetch(`/api/workouts/${w.workout_id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(await res.text());
			toast.success(`Deleted "${w.workout_name}"`);
			await invalidateAll();
		} catch (err) {
			toast.error("Couldn't delete workout", { description: err instanceof Error ? err.message : undefined });
			console.error(err);
		}
	}
	async function onSaved(workoutId?: number) {
		toast.success(workoutId ? 'Workout updated' : 'Workout created');
		editorOpen = false;
		await invalidateAll();
	}
</script>

<div class="space-y-2">
	<button
		type="button"
		class="cursor-pointer inline-flex w-full sm:w-auto justify-center sm:justify-start items-center gap-1 rounded-md border border-card-border bg-card px-2.5 py-1.5 text-xs text-text-secondary hover:text-text hover:border-text-dim transition-colors"
		onclick={newWorkout}
	><Plus size={12} weight="bold" /> New workout</button>

	{#each workouts as workout (workout.workout_id)}
		<div id="workout-{workout.workout_id}" class="rounded-lg bg-card">
			<WorkoutRow
				{workout}
				expanded={expandedId === workout.workout_id}
				ontoggle={() => toggleExpand(workout.workout_id)}
				onedit={() => editWorkout(workout)}
				ondelete={() => deleteWorkout(workout)}
			/>
			{#if expandedId === workout.workout_id}
				<WorkoutDetails {workout} />
			{/if}
		</div>
	{/each}

	{#if workouts.length === 0}
		<div class="rounded-lg bg-card px-4 py-6 text-center text-xs text-text-dim">
			No workouts saved
		</div>
	{/if}
</div>

<WorkoutEditorModal
	workout={editing}
	open={editorOpen}
	onClose={() => editorOpen = false}
	{onSaved}
/>
