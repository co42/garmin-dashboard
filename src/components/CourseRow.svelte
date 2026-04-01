<script lang="ts">
	import type { Course } from '$lib/types.js';
	import { formatDistance } from '$lib/format.js';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import PersonSimpleBike from 'phosphor-svelte/lib/PersonSimpleBike';
	import PersonSimpleHike from 'phosphor-svelte/lib/PersonSimpleHike';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import { C } from '$lib/colors.js';

	interface Props {
		course: Course;
		expanded?: boolean;
		ontoggle?: () => void;
	}

	let { course, expanded = false, ontoggle }: Props = $props();

	function fmtDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	const isTrail = $derived(
		course.activity_type === 'trail_running' ||
		(course.elevation_gain_meters > 0 && course.distance_meters > 0 &&
		 course.elevation_gain_meters / (course.distance_meters / 1000) > 15)
	);
</script>

<button
	type="button"
	class="w-full text-left px-4 py-3 cursor-pointer hover:bg-card-border/20 transition-colors rounded-lg"
	onclick={() => ontoggle?.()}
>
	<!-- Row 1: Name + date -->
	<div class="flex items-center gap-2 mb-1.5">
		<span style="color: {C.green};">
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
		<span class="font-medium text-text text-sm truncate">{course.name}</span>
		<span class="ml-auto shrink-0 flex items-center gap-2 text-xs text-text-dim num">
			{fmtDate(course.created_date)}
			{#if course.has_pace_band}
				<span class="text-[10px] text-blue-400/60 font-medium">PACE</span>
			{/if}
			<span class="text-text-dim">
				<CaretDown size={12} weight="bold" class="transition-transform {expanded ? 'rotate-180' : ''}" />
			</span>
		</span>
	</div>

	<!-- Row 2: Metrics -->
	<div class="flex items-center gap-3 text-xs">
		<span class="num text-text font-semibold">{formatDistance(course.distance_meters)}<span class="text-text-dim font-normal">km</span></span>
		<span class="num text-text-secondary">D+ {Math.round(course.elevation_gain_meters)}m</span>
		<span class="num text-text-secondary">D- {Math.round(course.elevation_loss_meters)}m</span>
	</div>
</button>
