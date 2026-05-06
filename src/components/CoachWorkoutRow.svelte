<script lang="ts">
	import type { CoachWorkout } from '$lib/types.js';
	import { fmtDist, fmtDuration, stepsEstimates } from '$lib/workout-steps.js';
	import { workoutBadge, teValueColor } from '$lib/badges.js';
	import { C } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Robot from 'phosphor-svelte/lib/Robot';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Timer from 'phosphor-svelte/lib/Timer';
	import Copy from 'phosphor-svelte/lib/Copy';

	interface Props {
		workout: CoachWorkout;
		expanded?: boolean;
		ontoggle?: () => void;
		oncopy?: () => void;
	}

	let { workout, expanded = false, ontoggle, oncopy }: Props = $props();

	const badge = $derived(workoutBadge(workout.workout_phrase, workout.workout_name));
	const est = $derived(workout.steps.length > 0 ? stepsEstimates(workout.steps) : null);
	const distM = $derived(workout.estimated_distance_meters ?? (est && est.dist > 0 ? est.dist : null));
	const durS = $derived(workout.estimated_duration_seconds ?? (est && est.time > 0 ? est.time : null));
	const aeroTE = $derived(workout.estimated_training_effect);
	const anaeroTE = $derived(workout.estimated_anaerobic_training_effect);

	// Row 2 description text: just the user-facing recipe (e.g. "9x0:40@3:20/km").
	// The prettified phrase ("Anaerobic Capacity") lives on row 1 as right-meta,
	// mirroring how ActivityRow shows date+weather there. Falls back to "—" for
	// symmetry with WorkoutRow when no description is set.
	const descText = $derived(workout.description?.trim() || '—');

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ontoggle?.();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="px-3 md:px-4 py-3 cursor-pointer hover:bg-card-border/20 transition-colors rounded-lg"
	role="button"
	tabindex="0"
	aria-expanded={expanded}
	onclick={() => ontoggle?.()}
	onkeydown={onKeydown}
>
	<!-- Row 1: icon + badge + name + (badge label as right-meta) + caret -->
	<div class="flex items-center gap-2.5 mb-1.5 leading-5">
		<span class="shrink-0 leading-[0]" style="color: {badge?.color ?? C.textDim};">
			<Robot size={16} weight="bold" />
		</span>
		{#if badge}
			<span class="shrink-0 num text-[10px] font-bold leading-[0] -ml-1" style="color: {badge.color};">
				<Tip text={badge.name}>{badge.code}</Tip>
			</span>
		{/if}
		<div class="min-w-0 flex-1">
			<div class="font-medium text-text text-sm truncate">{workout.workout_name}</div>
		</div>
		<span class="shrink-0 flex items-center gap-2 text-[10px] text-text-dim">
			{#if badge}<span class="truncate">{badge.name}</span>{/if}
			<span class="text-text-dim">
				<CaretDown size={12} weight="bold" class="transition-transform {expanded ? 'rotate-180' : ''}" />
			</span>
		</span>
	</div>

	<!-- Row 2: metrics + description + (TE values + save action right-aligned) -->
	<div class="flex flex-wrap items-end gap-x-3 gap-y-1.5 text-xs leading-none">
		{#if distM}
			<span class="num text-text font-semibold shrink-0">{fmtDist(distM)}</span>
		{/if}
		{#if durS}
			<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5"><Timer size={11} weight="bold" />{fmtDuration(durS)}</span>
		{/if}
		<span class="text-[11px] text-text-dim min-w-0 truncate">{descText}</span>

		<span class="flex items-center gap-2 shrink-0 ml-auto">
			{#if aeroTE != null || anaeroTE != null}
				<span class="flex items-center gap-1.5">
					<span class="num font-semibold leading-none" style="color: {teValueColor(aeroTE ?? 0)};">{(aeroTE ?? 0).toFixed(1)}</span>
					<span class="num font-semibold leading-none" style="color: {teValueColor(anaeroTE ?? 0)};">{(anaeroTE ?? 0).toFixed(1)}</span>
				</span>
			{/if}
			{#if oncopy}
				<Tip text="Save as my workout">
					<button
						type="button"
						class="cursor-pointer text-text-dim hover:text-blue-400 transition-colors"
						onclick={(e) => { e.stopPropagation(); oncopy?.(); }}
						aria-label="Save as my workout"
					><Copy size={13} weight="bold" /></button>
				</Tip>
			{/if}
		</span>
	</div>
</div>
