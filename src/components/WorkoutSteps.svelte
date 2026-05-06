<script lang="ts">
	import type { WorkoutStep } from '$lib/types.js';
	import { stepLabel, stepDuration, stepTarget, stepValues, stepExerciseName } from '$lib/workout-steps.js';

	interface Props {
		steps: WorkoutStep[];
		// Drives the table layout: running workouts get a 4-col Step/Dist/Time/Target/Note
		// table; everything else (strength/yoga/cardio) gets a 2-col Exercise/Reps table.
		sportType?: string | null;
	}

	let { steps, sportType = 'running' }: Props = $props();

	const isRunning = $derived(sportType == null || sportType === 'running');
</script>

{#snippet runStep(step: WorkoutStep, depth: number)}
	<tr class="border-b border-card-border/20 hover:bg-card-border/10">
		<td class="py-1 pr-4 font-medium text-text-secondary whitespace-nowrap" style="padding-left: {depth * 16}px">{stepLabel(step.step_type)}</td>
		<td class="py-1 pr-4 num text-text whitespace-nowrap">{stepDuration(step)}</td>
		<td class="py-1 pr-4 num text-text-secondary whitespace-nowrap">{stepTarget(step)}</td>
		<td class="py-1 text-text-dim text-[11px]">{step.description ?? ''}</td>
	</tr>
{/snippet}

{#snippet runSteps(list: WorkoutStep[], depth: number)}
	{#each list as step}
		{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
			<tr class="border-b border-card-border/20 bg-card-border/5">
				<td class="py-1 pr-4 num font-semibold text-text-secondary whitespace-nowrap" colspan="4" style="padding-left: {depth * 16}px">{step.number_of_iterations}×</td>
			</tr>
			{@render runSteps(step.steps ?? [], depth + 1)}
		{:else}
			{@render runStep(step, depth)}
		{/if}
	{/each}
{/snippet}

{#snippet nonRunStep(step: WorkoutStep, depth: number)}
	{@const name = stepExerciseName(step)}
	{@const vals = stepValues(step)}
	<tr class="border-b border-card-border/20 hover:bg-card-border/10">
		<td class="py-1 pr-4 text-text-secondary whitespace-nowrap" style="padding-left: {depth * 16}px">{name ?? stepLabel(step.step_type)}</td>
		<td class="py-1 num text-text whitespace-nowrap">{vals}</td>
	</tr>
{/snippet}

{#snippet nonRunSteps(list: WorkoutStep[], depth: number)}
	{#each list as step}
		{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
			<tr class="border-b border-card-border/20 bg-card-border/5">
				<td class="py-1 pr-4 num font-semibold text-text-secondary whitespace-nowrap" colspan="2" style="padding-left: {depth * 16}px">{step.number_of_iterations}×</td>
			</tr>
			{@render nonRunSteps(step.steps ?? [], depth + 1)}
		{:else}
			{@render nonRunStep(step, depth)}
		{/if}
	{/each}
{/snippet}

{#if isRunning}
	<table class="text-xs">
		<thead>
			<tr class="text-text-dim border-b border-card-border">
				<th class="pb-1 pr-4 text-left font-medium">Step</th>
				<th class="pb-1 pr-4 text-left font-medium">Dist/Time</th>
				<th class="pb-1 pr-4 text-left font-medium">Target</th>
				<th class="pb-1 text-left font-medium">Note</th>
			</tr>
		</thead>
		<tbody>
			{@render runSteps(steps, 0)}
		</tbody>
	</table>
{:else}
	<table class="text-xs">
		<thead>
			<tr class="text-text-dim border-b border-card-border">
				<th class="pb-1 pr-4 text-left font-medium">Exercise</th>
				<th class="pb-1 text-left font-medium">Reps/Time</th>
			</tr>
		</thead>
		<tbody>
			{@render nonRunSteps(steps, 0)}
		</tbody>
	</table>
{/if}
