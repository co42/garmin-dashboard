<script lang="ts">
	import type { CoachPlan, Course, EventProjection, RaceEvent } from '$lib/types.js';
	import Tip from './Tip.svelte';
	import EventCard from './EventCard.svelte';
	import FlagCheckered from 'phosphor-svelte/lib/FlagCheckered';

	interface Props {
		events: RaceEvent[];
		courses: Course[];
		coachPlan: CoachPlan | null;
		eventProjections: Record<number, EventProjection[]>;
		onNavigateCourse?: (courseId: number) => void;
	}

	let { events, courses, coachPlan, eventProjections, onNavigateCourse }: Props = $props();

	const courseMap = $derived(new Map(courses.map(c => [c.course_id, c])));
	const sorted = $derived([...events].sort((a, b) => a.date.localeCompare(b.date)));
</script>

<div class="mt-4 mb-1 flex items-center gap-3">
	<Tip text={"Your upcoming races and events.\nPrimary events embed plan + projection chart inline; secondary events with projections show the chart on its own."}>
		<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
			<FlagCheckered size={14} weight="bold" /> Events
		</h2>
	</Tip>
</div>

<div class="grid gap-4">
	{#each sorted as event (event.id)}
		<EventCard
			{event}
			{coachPlan}
			projections={eventProjections[event.id] ?? []}
			{courseMap}
			{onNavigateCourse}
		/>
	{/each}
</div>
