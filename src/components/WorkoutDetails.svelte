<script lang="ts">
	import type { Workout } from '$lib/types.js';
	import WorkoutSteps from './WorkoutSteps.svelte';

	interface Props {
		workout: Workout;
	}

	let { workout }: Props = $props();
</script>

<div class="px-3 md:px-4 pb-3 -mt-1">
	{#if workout.description}
		<p class="text-xs text-text-secondary mb-2">{workout.description}</p>
	{/if}
	{#if workout.steps.length > 0}
		<WorkoutSteps steps={workout.steps} sportType={workout.sport_type} />
	{:else}
		<div class="text-xs text-text-dim italic">No steps</div>
	{/if}
</div>
