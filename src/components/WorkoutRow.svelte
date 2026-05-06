<script lang="ts">
	import type { Workout } from '$lib/types.js';
	import { fmtDist, fmtDuration, stepsEstimates } from '$lib/workout-steps.js';
	import { C } from '$lib/colors.js';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Timer from 'phosphor-svelte/lib/Timer';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import Trash from 'phosphor-svelte/lib/Trash';

	interface Props {
		workout: Workout;
		expanded?: boolean;
		ontoggle?: () => void;
		onedit?: () => void;
		ondelete?: () => void;
	}

	let { workout, expanded = false, ontoggle, onedit, ondelete }: Props = $props();

	const isRunning = $derived(workout.sport_type == null || workout.sport_type === 'running');

	// Estimated dist/time: prefer Garmin-provided values; fall back to summing the
	// step structure so freshly-created or partially-populated workouts still show
	// something useful.
	const est = $derived(workout.steps.length > 0 ? stepsEstimates(workout.steps) : null);
	const distM = $derived(workout.estimated_distance_meters ?? (est && est.dist > 0 ? est.dist : null));
	const durS = $derived(workout.estimated_duration_seconds ?? (est && est.time > 0 ? est.time : null));

	// Display "—" rather than nothing when no description is set, mirroring the
	// activity/course pattern where row 2 always carries some content.
	const descText = $derived(workout.description?.trim() || '—');

	const updatedDate = $derived(formatUpdated(workout.updated_date));

	function formatUpdated(s: string): string {
		// Garmin stores "2025-09-27 19:25:37.0 GMT" — slice to YYYY-MM-DD then format.
		if (!s) return '';
		const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ontoggle?.();
		}
	}
</script>

<!-- Row card: outer is `role="button"` (not a real <button>) so we can nest
     real edit/delete buttons on row 2. Mirrors ActivityRow/CourseRow's
     two-line layout: row 1 = identity + right-meta, row 2 = metrics + actions. -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="px-3 md:px-4 py-3 cursor-pointer hover:bg-card-border/20 transition-colors rounded-lg"
	role="button"
	tabindex="0"
	aria-expanded={expanded}
	onclick={() => ontoggle?.()}
	onkeydown={onKeydown}
>
	<!-- Row 1: icon + name + last-edited date + caret -->
	<div class="flex items-center gap-2.5 mb-1.5 leading-5">
		<span class="shrink-0 leading-[0]" style="color: {isRunning ? C.green : C.textSecondary};">
			{#if isRunning}
				<PersonSimpleRun size={16} weight="bold" />
			{:else}
				<Barbell size={16} weight="bold" />
			{/if}
		</span>
		<div class="min-w-0 flex-1">
			<div class="font-medium text-text text-sm truncate">{workout.workout_name}</div>
		</div>
		<span class="shrink-0 flex items-center gap-2 text-[10px] text-text-dim num">
			{#if updatedDate}{updatedDate}{/if}
			<span class="text-text-dim">
				<CaretDown size={12} weight="bold" class="transition-transform {expanded ? 'rotate-180' : ''}" />
			</span>
		</span>
	</div>

	<!-- Row 2: metrics + description + edit/delete -->
	<div class="flex flex-wrap items-end gap-x-3 gap-y-1.5 text-xs leading-none">
		{#if distM}
			<span class="num text-text font-semibold shrink-0">{fmtDist(distM)}</span>
		{/if}
		{#if durS}
			<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5"><Timer size={11} weight="bold" />{fmtDuration(durS)}</span>
		{/if}
		<span class="text-[11px] text-text-dim min-w-0 truncate">{descText}</span>

		<span class="flex items-center gap-2 shrink-0 ml-auto">
			{#if onedit}
				<button
					type="button"
					class="cursor-pointer text-text-dim hover:text-text-secondary transition-colors"
					onclick={(e) => { e.stopPropagation(); onedit?.(); }}
					aria-label="Edit workout"
				><PencilSimple size={13} weight="bold" /></button>
			{/if}
			{#if ondelete}
				<button
					type="button"
					class="cursor-pointer text-text-dim hover:text-status-red transition-colors"
					onclick={(e) => { e.stopPropagation(); ondelete?.(); }}
					aria-label="Delete workout"
				><Trash size={13} weight="bold" /></button>
			{/if}
		</span>
	</div>
</div>
