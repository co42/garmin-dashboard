<script lang="ts">
	import type { Activity, ActivitySplit, ActivityDetails, HrZone } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import ActivityCard from './ActivityCard.svelte';

	interface Props {
		activities: Activity[];
		splits: Record<number, ActivitySplit[]>;
		details: Record<number, ActivityDetails>;
		hrZones: HrZone[];
	}

	let { activities, splits, details, hrZones }: Props = $props();

	let showCount = $state(15);

	const displayed = $derived(activities.slice(0, showCount));
	const hasMore = $derived(showCount < activities.length);

	// Color load relative to the median load across all activities
	const medianLoad = $derived(() => {
		const loads = activities.map(a => a.activity_training_load).filter((l): l is number => l != null).sort((a, b) => a - b);
		if (loads.length === 0) return 100;
		return loads[Math.floor(loads.length / 2)];
	});

	function loadColor(load: number | null): string {
		if (load == null) return C.textDim;
		const med = medianLoad();
		const ratio = load / med;
		if (ratio < 0.7) return C.blue;
		if (ratio < 1.0) return C.green;
		if (ratio < 1.4) return C.amber;
		return C.red;
	}
</script>

<div class="space-y-2">
	{#each displayed as activity (activity.id)}
		<ActivityCard
			{activity}
			splits={splits[activity.id] ?? []}
			details={details[activity.id] ?? null}
			{hrZones}
			loadColor={loadColor(activity.activity_training_load)}
		/>
	{/each}

	{#if hasMore}
		<button
			class="w-full rounded-lg border border-card-border bg-card px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-card-border/30 transition-colors"
			onclick={() => showCount += 15}
		>
			Show more ({activities.length - showCount} remaining)
		</button>
	{/if}
</div>
