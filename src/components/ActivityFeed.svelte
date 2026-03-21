<script lang="ts">
	import type { Activity } from '$lib/types.js';
	import { formatDate, formatDistance, formatPace } from '$lib/format.js';

	interface Props {
		activities: Activity[];
		lactateHr: number | null;
	}

	let { activities, lactateHr }: Props = $props();

	function intensityDots(avgHr: number | null, ltHr: number | null): number {
		if (avgHr == null || ltHr == null || ltHr === 0) return 0;
		const ratio = avgHr / ltHr;
		if (ratio < 0.7) return 1;
		if (ratio < 0.8) return 2;
		if (ratio < 0.9) return 3;
		if (ratio < 1.0) return 4;
		return 5;
	}

	function dotColor(filled: boolean): string {
		return filled ? '#f59e0b' : '#2a2a3a';
	}

	function badgeColor(label: string | null): string {
		if (!label) return '#555568';
		const l = label.toUpperCase();
		if (l.includes('TEMPO') || l.includes('THRESHOLD')) return '#f59e0b';
		if (l.includes('INTERVAL') || l.includes('SPEED') || l.includes('VO2MAX')) return '#ef4444';
		if (l.includes('RECOVERY') || l.includes('BASE')) return '#14b8a6';
		if (l.includes('LONG')) return '#3b82f6';
		return '#22c55e'; // default / easy
	}

	function formatTELabel(label: string | null): string {
		if (!label) return '-';
		return label.charAt(0) + label.slice(1).toLowerCase().replace(/_/g, ' ');
	}
</script>

<div class="rounded-lg bg-card p-4 overflow-x-auto">
	<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">Recent Activities</h2>

	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-card-border text-left text-xs text-text-dim">
				<th class="pb-2 pr-3 font-medium">Date</th>
				<th class="pb-2 pr-3 font-medium">Type</th>
				<th class="pb-2 pr-3 font-medium">Name</th>
				<th class="pb-2 pr-3 font-medium text-right">Dist</th>
				<th class="pb-2 pr-3 font-medium text-right">Pace</th>
				<th class="pb-2 pr-3 font-medium text-right">HR</th>
				<th class="pb-2 pr-3 font-medium text-right">Load</th>
				<th class="pb-2 font-medium">Intensity</th>
			</tr>
		</thead>
		<tbody>
			{#each activities as activity}
				{@const dots = intensityDots(activity.avg_hr, lactateHr)}
				{@const teColor = badgeColor(activity.training_effect_label)}
				<tr class="border-b border-card-border/50 hover:bg-card-border/20">
					<td class="py-2 pr-3 text-text-secondary whitespace-nowrap">{formatDate(activity.start_time)}</td>
					<td class="py-2 pr-3">
						<span
							class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
							style="background: {teColor}20; color: {teColor};"
						>
							{formatTELabel(activity.training_effect_label)}
						</span>
					</td>
					<td class="py-2 pr-3 font-medium text-text max-w-[200px] truncate">{activity.name}</td>
					<td class="py-2 pr-3 text-right text-text tabular-nums">{formatDistance(activity.distance_meters)} km</td>
					<td class="py-2 pr-3 text-right text-text-secondary tabular-nums whitespace-nowrap">
						{activity.pace_min_km ?? formatPace(activity.duration_seconds, activity.distance_meters)}
					</td>
					<td class="py-2 pr-3 text-right text-text tabular-nums">{activity.avg_hr ?? '-'}</td>
					<td class="py-2 pr-3 text-right text-text tabular-nums">{activity.activity_training_load != null ? Math.round(activity.activity_training_load) : '-'}</td>
					<td class="py-2">
						<div class="flex gap-0.5">
							{#each Array(5) as _, i}
								<div
									class="h-2 w-2 rounded-full"
									style="background: {dotColor(i < dots)};"
								></div>
							{/each}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
