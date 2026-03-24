<script lang="ts">
	import type { Activity, ActivitySplit, ActivityDetails, HrZone } from '$lib/types.js';
	import { formatDistance, formatTime } from '$lib/format.js';
	import { C, ZONE_COLORS } from '$lib/colors.js';
	import SplitsChart from './SplitsChart.svelte';
	import ActivityMap from './ActivityMap.svelte';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import PersonSimpleBike from 'phosphor-svelte/lib/PersonSimpleBike';
	import PersonSimpleSwim from 'phosphor-svelte/lib/PersonSimpleSwim';
	import PersonSimpleHike from 'phosphor-svelte/lib/PersonSimpleHike';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';

	interface Props {
		activity: Activity;
		splits: ActivitySplit[];
		details: ActivityDetails | null;
		hrZones: HrZone[];
		loadColor: string;
	}

	let { activity, splits, details, hrZones, loadColor }: Props = $props();
	let expanded = $state(false);

	function fmtDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
	}

	function fmtTime(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
	}

	function badgeColor(label: string | null): string {
		if (!label) return C.textDim;
		const l = label.toUpperCase();
		if (l.includes('TEMPO') || l.includes('THRESHOLD')) return C.amber;
		if (l.includes('INTERVAL') || l.includes('SPEED') || l.includes('VO2MAX')) return C.red;
		if (l.includes('RECOVERY') || l.includes('BASE')) return C.teal;
		if (l.includes('LONG')) return C.blue;
		return C.green;
	}

	function formatTELabel(label: string | null): string {
		if (!label) return '';
		return label.charAt(0) + label.slice(1).toLowerCase().replace(/_/g, ' ');
	}

	function speedToPace(speed: number | null): string {
		if (!speed || speed <= 0) return '-';
		const paceSeconds = 1000 / speed;
		const m = Math.floor(paceSeconds / 60);
		const s = Math.floor(paceSeconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function zoneData(a: Activity): { pcts: number[]; times: number[]; total: number } {
		const times = [
			a.hr_time_in_zone_1 ?? 0, a.hr_time_in_zone_2 ?? 0,
			a.hr_time_in_zone_3 ?? 0, a.hr_time_in_zone_4 ?? 0, a.hr_time_in_zone_5 ?? 0,
		];
		const total = times.reduce((s, v) => s + v, 0);
		return { pcts: times.map(z => total > 0 ? z / total * 100 : 0), times, total };
	}

	function fmtZoneTime(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		return `${Math.floor(seconds / 60)}m`;
	}

	const teColor = $derived(badgeColor(activity.training_effect_label));
	const zones = $derived(zoneData(activity));
	const hasElevation = $derived(activity.elevation_gain != null && activity.elevation_gain > 0);
	const hasMap = $derived(details != null && details.polyline.length > 1);
	const hasTimeseries = $derived(details != null && details.timeseries.length > 5);
	const hasElev = $derived(splits.some(s => s.elevation_gain > 0));
	const hasPower = $derived(splits.some(s => s.avg_power > 0));
	const hasCadence = $derived(splits.some(s => s.avg_cadence > 0));

	const advancedMetrics = $derived(([
		activity.avg_grade_adjusted_speed ? { label: 'GAP', value: speedToPace(activity.avg_grade_adjusted_speed) + ' /km' } : null,
		activity.aerobic_training_effect ? { label: 'Aero TE', value: activity.aerobic_training_effect.toFixed(1) } : null,
		activity.anaerobic_training_effect ? { label: 'Anaero TE', value: activity.anaerobic_training_effect.toFixed(1) } : null,
		activity.vo2max_value ? { label: 'VO2max', value: String(activity.vo2max_value) } : null,
		activity.avg_stride_length ? { label: 'Stride', value: activity.avg_stride_length.toFixed(2) + 'm' } : null,
		activity.avg_ground_contact_time ? { label: 'GCT', value: Math.round(activity.avg_ground_contact_time) + 'ms' } : null,
		activity.avg_vertical_oscillation ? { label: 'Vert Osc', value: activity.avg_vertical_oscillation.toFixed(1) + 'cm' } : null,
		activity.avg_vertical_ratio ? { label: 'Vert Ratio', value: activity.avg_vertical_ratio.toFixed(1) + '%' } : null,
		activity.avg_power ? { label: 'Avg Power', value: Math.round(activity.avg_power) + 'W' } : null,
		activity.max_hr ? { label: 'Max HR', value: activity.max_hr + ' bpm' } : null,
		activity.calories ? { label: 'Calories', value: String(activity.calories) } : null,
		activity.difference_body_battery != null ? { label: 'BB delta', value: (activity.difference_body_battery > 0 ? '+' : '') + activity.difference_body_battery } : null,
		hasElevation && activity.elevation_loss ? { label: 'D-', value: activity.elevation_loss + 'm' } : null,
	]).filter(Boolean) as { label: string; value: string }[]);
</script>

<div class="rounded-lg bg-card overflow-hidden">
	<!-- Compact card -->
	<div
		class="w-full text-left px-4 py-3 hover:bg-card-border/20 transition-colors cursor-pointer"
		role="button"
		tabindex="0"
		onclick={() => expanded = !expanded}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expanded = !expanded; } }}
	>
		<div class="flex items-center gap-2 mb-1.5">
			<span style="color: {teColor};">
				{#if activity.activity_type === 'trail_running'}
					<Mountains size={16} weight="bold" />
				{:else if activity.activity_type === 'cycling' || activity.activity_type === 'indoor_cycling'}
					<PersonSimpleBike size={16} weight="bold" />
				{:else if activity.activity_type === 'swimming' || activity.activity_type === 'open_water_swimming'}
					<PersonSimpleSwim size={16} weight="bold" />
				{:else if activity.activity_type === 'hiking'}
					<PersonSimpleHike size={16} weight="bold" />
				{:else if activity.activity_type === 'strength_training' || activity.activity_type === 'cardio_training'}
					<Barbell size={16} weight="bold" />
				{:else}
					<PersonSimpleRun size={16} weight="bold" />
				{/if}
			</span>
			<span class="font-medium text-text text-sm truncate">{activity.name}</span>
			{#if activity.training_effect_label}
				<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style="background: {teColor}20; color: {teColor};">
					{formatTELabel(activity.training_effect_label)}
				</span>
			{/if}
			<span class="ml-auto shrink-0 flex items-center gap-2 text-xs text-text-dim num">
				{fmtDate(activity.start_time)} {fmtTime(activity.start_time)}
				{#if activity.location_name}
					<span class="text-text-dim">· {activity.location_name}</span>
				{/if}
				<CaretDown size={12} weight="bold" class="transition-transform {expanded ? 'rotate-180' : ''}" />
			</span>
		</div>

		<div class="flex items-center gap-4 text-xs">
			<span class="num text-text font-semibold">{formatDistance(activity.distance_meters)} km</span>
			<span class="num text-text-secondary">{formatTime(activity.duration_seconds)}</span>
			{#if activity.pace_min_km}
				<span class="num text-text-secondary">{activity.pace_min_km.replace(' /km', '')} /km</span>
			{/if}
			{#if hasElevation}
				<span class="num text-text-secondary">D+ {activity.elevation_gain}m</span>
			{/if}
			{#if activity.avg_hr}
				<span class="num text-text-secondary">&#9829; {activity.avg_hr}</span>
			{/if}
			<span class="num font-bold" style="color: {loadColor}">
				{activity.activity_training_load != null ? Math.round(activity.activity_training_load) : ''}
			</span>
			{#if zones.total > 0}
				{@const maxPct = Math.max(...zones.pcts)}
				<div class="flex items-end gap-px h-4 w-16 ml-auto">
					{#each zones.pcts as pct, i}
						<div
							class="flex-1 rounded-t-sm"
							style="height: {maxPct > 0 ? Math.max((pct / maxPct) * 100, pct > 0 ? 12 : 0) : 0}%; background: {ZONE_COLORS[i]}; {pct === 0 ? `background: ${ZONE_COLORS[i]}30; min-height: 2px;` : ''}"
						></div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Expanded -->
	{#if expanded}
		<div class="border-t border-card-border/50 px-4 py-4 space-y-3">

			<!-- Row 1: Map (left) + Splits table (right) -->
			<div class="grid gap-4 {hasMap ? 'md:grid-cols-2' : ''}">
				{#if hasMap && details}
					<div class="h-[240px] rounded overflow-hidden border border-card-border/50">
						<ActivityMap polyline={details.polyline} />
					</div>
				{/if}

				{#if splits.length > 0}
					<div class="overflow-y-auto max-h-[240px]">
						<table class="w-full text-xs">
							<thead class="sticky top-0 bg-card">
								<tr class="text-text-dim border-b border-card-border">
									<th class="pb-1 pr-2 text-left font-medium w-8">km</th>
									<th class="pb-1 pr-2 text-right font-medium">Pace</th>
									<th class="pb-1 pr-2 text-right font-medium">HR</th>
									{#if hasElev}
										<th class="pb-1 pr-2 text-right font-medium">D+</th>
										<th class="pb-1 pr-2 text-right font-medium">D-</th>
									{/if}
									{#if hasPower}
										<th class="pb-1 pr-2 text-right font-medium">Pwr</th>
									{/if}
									{#if hasCadence}
										<th class="pb-1 text-right font-medium">Cad</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each splits as split}
									<tr class="border-b border-card-border/20 hover:bg-card-border/10">
										<td class="py-0.5 pr-2 num text-text-dim">{split.split}</td>
										<td class="py-0.5 pr-2 num text-right text-text">{split.pace?.replace(' /km', '') ?? '-'}</td>
										<td class="py-0.5 pr-2 num text-right text-text-secondary">{split.avg_hr || '-'}</td>
										{#if hasElev}
											<td class="py-0.5 pr-2 num text-right text-text-secondary">+{Math.round(split.elevation_gain)}</td>
											<td class="py-0.5 pr-2 num text-right text-text-secondary">-{Math.round(split.elevation_loss)}</td>
										{/if}
										{#if hasPower}
											<td class="py-0.5 pr-2 num text-right text-text-secondary">{Math.round(split.avg_power) || '-'}</td>
										{/if}
										{#if hasCadence}
											<td class="py-0.5 num text-right text-text-secondary">{Math.round(split.avg_cadence) || '-'}</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Row 2: Chart full width -->
			{#if hasTimeseries && details}
				<SplitsChart timeseries={details.timeseries} />
			{/if}

			<!-- Row 3: Zones + Metrics in a compact strip -->
			<div class="flex items-start gap-6 pt-1">
				<!-- HR Zones compact -->
				{#if zones.total > 0}
					<div class="flex gap-1 items-end shrink-0">
						{#each zones.pcts as pct, i}
							{@const hz = hrZones.find(h => h.zone === i + 1)}
							<div class="flex flex-col items-center">
								<div class="w-6 h-10 rounded-sm bg-card-border/30 overflow-hidden flex items-end">
									<div class="w-full rounded-t-sm" style="height: {pct}%; background: {ZONE_COLORS[i]}; min-height: {pct > 0 ? 2 : 0}px;"></div>
								</div>
								<span class="num text-[8px] mt-0.5" style="color: {ZONE_COLORS[i]}">Z{i + 1}</span>
								<span class="num text-[8px] text-text-dim">{Math.round(pct)}%</span>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Metrics grid -->
				{#if advancedMetrics.length > 0}
					<div class="flex flex-wrap gap-x-5 gap-y-1">
						{#each advancedMetrics as m}
							<div>
								<span class="text-[10px] text-text-dim">{m.label}</span>
								<span class="num text-xs text-text-secondary ml-1">{m.value}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
