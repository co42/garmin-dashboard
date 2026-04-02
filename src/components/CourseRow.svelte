<script lang="ts">
	import type { Course } from '$lib/types.js';
	import { formatDistance } from '$lib/format.js';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import PersonSimpleBike from 'phosphor-svelte/lib/PersonSimpleBike';
	import PersonSimpleHike from 'phosphor-svelte/lib/PersonSimpleHike';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import TrendUp from 'phosphor-svelte/lib/TrendUp';
	import TrendDown from 'phosphor-svelte/lib/TrendDown';
	import { C } from '$lib/colors.js';

	interface Props {
		course: Course;
		expanded?: boolean;
		ontoggle?: () => void;
	}

	let { course, expanded = false, ontoggle }: Props = $props();

	function fmtDate(dateStr: string): string {
		// Garmin stores "2025-09-27 19:25:37.0 GMT" — normalize for Safari
		const d = new Date(dateStr.slice(0, 10) + 'T12:00:00Z');
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
	}

	const isTrail = $derived(
		course.activity_type === 'trail_running' ||
		(course.elevation_gain_meters > 0 && course.distance_meters > 0 &&
		 course.elevation_gain_meters / (course.distance_meters / 1000) > 15)
	);

	const iconColor = $derived(isTrail ? C.orange : C.green);
</script>

<button
	type="button"
	class="w-full text-left px-3 md:px-4 py-3 cursor-pointer hover:bg-card-border/20 transition-colors rounded-lg"
	onclick={() => ontoggle?.()}
>
	<!-- Row 1: Name + date -->
	<div class="flex items-center gap-2.5 mb-1.5 leading-5">
		<span class="shrink-0 leading-[0]" style="color: {iconColor};">
			{#if course.activity_type === 'trail_running'}
				<Mountains size={16} weight="bold" />
			{:else if course.activity_type === 'cycling'}
				<PersonSimpleBike size={16} weight="bold" />
			{:else if course.activity_type === 'hiking'}
				<PersonSimpleHike size={16} weight="bold" />
			{:else}
				<PersonSimpleRun size={16} weight="bold" />
			{/if}
		</span>
		<div class="min-w-0 flex-1">
			<div class="font-medium text-text text-sm truncate">{course.name}</div>
		</div>
		<span class="shrink-0 flex items-center gap-2 text-[10px] text-text-dim num">
			{fmtDate(course.created_date)}
			<span class="text-text-dim">
				<CaretDown size={12} weight="bold" class="transition-transform {expanded ? 'rotate-180' : ''}" />
			</span>
		</span>
	</div>

	<!-- Row 2: Metrics -->
	<div class="flex flex-nowrap items-end gap-3 text-xs leading-none overflow-hidden">
		<span class="num text-text font-semibold shrink-0">{formatDistance(course.distance_meters)}<span class="text-text-dim font-normal">km</span></span>
		<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5"><TrendUp size={11} weight="bold" />{Math.round(course.elevation_gain_meters)}m</span>
		<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5"><TrendDown size={11} weight="bold" />{Math.round(course.elevation_loss_meters)}m</span>
	</div>
</button>
