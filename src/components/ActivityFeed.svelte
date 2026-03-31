<script lang="ts">
	import { tick } from 'svelte';
	import type { Activity, ActivitySplit, ActivityDetails, ActivityWeather, HrZone } from '$lib/types.js';
	import { computeMedianLoad, loadColor as computeLoadColor } from '$lib/colors.js';
	import { formatDistance } from '$lib/format.js';
	import ActivityRow from './ActivityRow.svelte';
	import ActivityDetailsComp from './ActivityDetails.svelte';

	interface Props {
		activities: Activity[];
		splits: Record<number, ActivitySplit[]>;
		details: Record<number, ActivityDetails>;
		weather: Record<number, ActivityWeather>;
		hrZones: HrZone[];
	}

	let { activities, splits, details, weather, hrZones }: Props = $props();

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// State
	let selectedYear = $state(new Date().getFullYear());
	let selectedMonth = $state(new Date().getMonth());
	let expandedId = $state<number | null>(null);

	// Available years from activities
	const years = $derived(() => {
		const ySet = new Set<number>();
		for (const a of activities) {
			ySet.add(new Date(a.start_time).getFullYear());
		}
		return [...ySet].sort();
	});

	// Activities per month for the selected year (for badges/dimming)
	const monthCounts = $derived(() => {
		const counts = new Array(12).fill(0);
		for (const a of activities) {
			const d = new Date(a.start_time);
			if (d.getFullYear() === selectedYear) {
				counts[d.getMonth()]++;
			}
		}
		return counts;
	});

	// Filtered activities for selected year+month
	const displayed = $derived(() => {
		return activities.filter(a => {
			const d = new Date(a.start_time);
			return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
		});
	});

	// Stats for selected year
	const yearStats = $derived(() => {
		const yearActivities = activities.filter(a => new Date(a.start_time).getFullYear() === selectedYear);
		const totalKm = yearActivities.reduce((s, a) => s + (a.distance_meters ?? 0), 0) / 1000;
		return { count: yearActivities.length, km: totalKm };
	});

	// Stats for selected month
	const monthStats = $derived(() => {
		const d = displayed();
		const totalKm = d.reduce((s, a) => s + (a.distance_meters ?? 0), 0) / 1000;
		return { count: d.length, km: totalKm };
	});

	// Median load across ALL activities (not just filtered)
	const medianLoad = $derived(computeMedianLoad(activities.map(a => a.activity_training_load)));

	function getLoadColor(load: number | null): string {
		return computeLoadColor(load, medianLoad);
	}

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	/** Called from calendar/race times to navigate to a specific activity */
	export async function navigateTo(activityId: number) {
		const a = activities.find(a => a.id === activityId);
		if (!a) return;
		const d = new Date(a.start_time);
		selectedYear = d.getFullYear();
		selectedMonth = d.getMonth();
		expandedId = activityId;
		await tick();
		const el = document.getElementById(`activity-${activityId}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<div class="space-y-3">
	<!-- Year tabs -->
	<div class="flex items-center gap-1 flex-wrap">
		{#each years() as year}
			{@const yCount = activities.filter(a => new Date(a.start_time).getFullYear() === year).length}
			<button
				class="cursor-pointer px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors {year === selectedYear ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
				onclick={() => { selectedYear = year; if (monthCounts()[selectedMonth] === 0) { const lastMonth = monthCounts().findLastIndex((c: number) => c > 0); if (lastMonth >= 0) selectedMonth = lastMonth; } }}
			>
				{year}
				<span class="text-[9px] text-text-dim ml-0.5">{yCount}</span>
			</button>
		{/each}
		<span class="ml-2 num text-[10px] text-text-dim">{formatDistance(yearStats().km * 1000)} km</span>
	</div>

	<!-- Month tabs -->
	<div class="flex items-center gap-0.5 flex-wrap">
		{#each MONTHS as month, i}
			{@const count = monthCounts()[i]}
			<button
				class="cursor-pointer px-2.5 py-1 rounded-md text-xs font-mono transition-colors {i === selectedMonth ? 'bg-blue-500/20 text-blue-400 font-medium' : count > 0 ? 'text-text-secondary hover:text-text' : 'text-text-dim/40 cursor-default'}"
				onclick={() => { if (count > 0) selectedMonth = i; }}
				disabled={count === 0}
			>
				{month}
				{#if count > 0}
					<span class="text-[9px] text-text-dim ml-0.5">{count}</span>
				{/if}
			</button>
		{/each}
		<span class="ml-2 num text-[10px] text-text-dim">{formatDistance(monthStats().km * 1000)} km</span>
	</div>

	<!-- Activity list -->
	<div class="space-y-2">
		{#each displayed() as activity (activity.id)}
			<div id="activity-{activity.id}" class="rounded-lg bg-card">
				<ActivityRow
					{activity}
					splits={splits[activity.id]}
					weather={weather[activity.id] ?? null}
					{hrZones}
					loadColor={getLoadColor(activity.activity_training_load)}
					context="feed"
					expanded={expandedId === activity.id}
					ontoggle={() => toggleExpand(activity.id)}
				/>
				{#if expandedId === activity.id}
					<ActivityDetailsComp
						{activity}
						splits={splits[activity.id] ?? []}
						details={details[activity.id] ?? null}
						weather={weather[activity.id] ?? null}
						{hrZones}
					/>
				{/if}
			</div>
		{/each}

		{#if displayed().length === 0}
			<div class="rounded-lg bg-card px-4 py-6 text-center text-xs text-text-dim">
				No activities in {MONTHS[selectedMonth]} {selectedYear}
			</div>
		{/if}
	</div>
</div>
