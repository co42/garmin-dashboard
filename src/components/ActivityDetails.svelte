<script lang="ts">
	import type { Activity, ActivitySplit, ActivityDetails as ActivityDetailsType, ActivityWeather, HrZone } from '$lib/types.js';
	import { formatTime } from '$lib/format.js';
	import { C, hrZoneColor, gradColor } from '$lib/colors.js';
	import ActivityCharts from './ActivityCharts.svelte';
	import ActivityMap from './ActivityMap.svelte';
	import Tip from './Tip.svelte';
	import Thermometer from 'phosphor-svelte/lib/Thermometer';
	import Wind from 'phosphor-svelte/lib/Wind';
	import Drop from 'phosphor-svelte/lib/Drop';
	import NoteBlank from 'phosphor-svelte/lib/NoteBlank';
	import CloudSun from 'phosphor-svelte/lib/CloudSun';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import ChartLine from 'phosphor-svelte/lib/ChartLine';
	import Gauge from 'phosphor-svelte/lib/Gauge';

	interface Props {
		activity: Activity;
		splits: ActivitySplit[];
		details: ActivityDetailsType | null;
		weather: ActivityWeather | null;
		hrZones: HrZone[];
	}

	let { activity, splits, details, weather, hrZones }: Props = $props();

	// Editable state
	let description = $state('');
	let editingDesc = $state(false);
	let descLoaded = $state(false);

	// Lazy-load description on first render
	$effect(() => {
		if (!descLoaded) {
			descLoaded = true;
			fetch(`/api/activity/${activity.id}`)
				.then(r => r.ok ? r.json() : null)
				.then(data => { if (data) description = data.description ?? ''; })
				.catch(() => {});
		}
	});

	async function saveDescription() {
		editingDesc = false;
		await fetch(`/api/activity/${activity.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ description }),
		});
	}

	function speedToPace(speed: number | null): string {
		if (!speed || speed <= 0) return '-';
		const paceSeconds = 1000 / speed;
		const m = Math.floor(paceSeconds / 60);
		const s = Math.floor(paceSeconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatSplitSeconds(seconds: number | null): string {
		if (!seconds || seconds <= 0) return '-';
		return formatTime(seconds);
	}

	function isTrail(a: Activity): boolean {
		if (!a.elevation_gain || !a.distance_meters || a.distance_meters < 1000) return false;
		return a.elevation_gain / (a.distance_meters / 1000) > 15;
	}


	const trail = $derived(isTrail(activity));

	// Compute per-km GAP from timeseries
	const splitGaps = $derived(() => {
		if (!details || !trail) return new Map<number, string>();
		const gaps = new Map<number, string>();
		const byKm = new Map<number, number[]>();
		for (const p of details.timeseries) {
			if (p.gap == null || p.gap <= 0 || p.gap > 900) continue;
			const km = Math.floor(p.dist / 1000) + 1;
			if (!byKm.has(km)) byKm.set(km, []);
			byKm.get(km)!.push(p.gap);
		}
		for (const [km, vals] of byKm) {
			const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
			const m = Math.floor(avg / 60);
			const s = Math.floor(avg % 60);
			gaps.set(km, `${m}:${s.toString().padStart(2, '0')}`);
		}
		return gaps;
	});
	const hasMap = $derived(details != null && details.polyline.length > 1);
	const hasTimeseries = $derived(details != null && details.timeseries.length > 5);
	const hasElev = $derived(splits.some(s => s.elevation_gain > 0));
	const hasPower = $derived(splits.some(s => s.avg_power > 0));
	const hasCadence = $derived(splits.some(s => s.avg_cadence > 0));
	const hasElevTimeseries = $derived(details != null && details.timeseries.some(p => p.elev != null));

	const advancedMetrics = $derived(([
		activity.fastest_split_1000 ? { label: 'Best 1km', value: formatSplitSeconds(activity.fastest_split_1000), tip: 'Fastest 1km split in this activity.' } : null,
		activity.fastest_split_5000 ? { label: 'Best 5km', value: formatSplitSeconds(activity.fastest_split_5000), tip: 'Fastest 5km split in this activity.\nOnly meaningful for runs longer than 5km.' } : null,
		(() => { const cs = splits.filter(s => s.avg_cadence > 0 && s.duration_seconds > 0); if (cs.length === 0) return null; const totalDur = cs.reduce((s, x) => s + x.duration_seconds, 0); const avg = cs.reduce((s, x) => s + x.avg_cadence * x.duration_seconds, 0) / totalDur; return { label: 'Cadence', value: Math.round(avg) + ' spm', tip: 'Average cadence (steps per minute), weighted by split duration.' }; })(),
		activity.avg_stride_length ? { label: 'Stride', value: activity.avg_stride_length.toFixed(2) + 'm', tip: 'Average stride length.\nLonger strides at the same cadence = faster pace.' } : null,
		activity.avg_ground_contact_time ? { label: 'GCT', value: Math.round(activity.avg_ground_contact_time) + 'ms', tip: 'Ground Contact Time — how long your foot stays on the ground per step.\nLower is generally better (elite ~200ms, recreational ~280ms+).' } : null,
		activity.avg_vertical_oscillation ? { label: 'Vert Osc', value: activity.avg_vertical_oscillation.toFixed(1) + 'cm', tip: 'Vertical Oscillation — how much you bounce per step.\nLess bounce = more efficient running.' } : null,
		activity.avg_vertical_ratio ? { label: 'Vert Ratio', value: activity.avg_vertical_ratio.toFixed(1) + '%', tip: 'Vertical Ratio — vertical oscillation divided by stride length.\nLower = more horizontal movement per step = better economy.' } : null,
		activity.avg_power ? { label: 'Avg Power', value: Math.round(activity.avg_power) + 'W', tip: 'Average running power.\nMeasures total effort including hills and wind.\nUseful for pacing on variable terrain.' } : null,
		activity.calories ? { label: 'Calories', value: String(activity.calories), tip: 'Estimated energy expenditure.\nBased on HR, weight, and duration. Approximate.' } : null,
		activity.difference_body_battery != null ? { label: 'BB delta', value: (activity.difference_body_battery > 0 ? '+' : '') + activity.difference_body_battery, tip: 'Body Battery drained by this session.\nShows the physiological cost of the workout.' } : null,
		activity.elevation_loss ? { label: 'D-', value: activity.elevation_loss + 'm', tip: 'Total descent during this activity.' } : null,
	]).filter(Boolean) as { label: string; value: string; tip: string }[]);
</script>

<div class="border-t border-card-border/50 px-3 md:px-4 py-4 space-y-5">

	<!-- ═══ NOTE ═══ -->
	<div>
		<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><NoteBlank size={12} weight="bold" /> Note</h3>
		{#if editingDesc}
			<!-- svelte-ignore a11y_autofocus -->
			<textarea
				class="w-full bg-card-border/20 rounded text-xs text-text-secondary p-2 outline-none border border-card-border/50 focus:border-blue-500/50 resize-none"
				rows="2"
				bind:value={description}
				onblur={saveDescription}
				onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') { editingDesc = false; } }}
				autofocus
			></textarea>
		{:else}
			<button
				class="cursor-pointer text-xs text-text-dim hover:text-text-secondary transition-colors"
				onclick={() => editingDesc = true}
			>
				{description || 'add a note...'}
			</button>
		{/if}
	</div>

	<!-- ═══ WEATHER ═══ -->
	{#if weather}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><CloudSun size={12} weight="bold" /> Weather</h3>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-dim">
				<span class="flex items-center gap-1"><Thermometer size={12} weight="bold" /> <span class="num">{Math.round(weather.temperature_celsius)}°C</span> <span class="text-text-dim">feels {Math.round(weather.feels_like_celsius)}°</span></span>
				<span class="flex items-center gap-1"><Wind size={12} weight="bold" /> <span class="num">{Math.round(weather.wind_speed_kmh)} km/h {weather.wind_direction_compass}</span></span>
				<span class="flex items-center gap-1"><Drop size={12} weight="bold" /> <span class="num">{Math.round(weather.humidity_percent)}%</span></span>
				<span class="text-text-secondary">{weather.weather_description}</span>
			</div>
		</div>
	{/if}

	<!-- ═══ MAP + SPLITS ═══ -->
	{#if hasMap || splits.length > 0}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><MapPin size={12} weight="bold" /> Map & Splits</h3>
			<div class="flex flex-col md:flex-row gap-4">
				{#if hasMap && details}
					<div class="h-[200px] md:h-[240px] md:flex-1 md:min-w-0 rounded overflow-hidden border border-card-border/50">
						<ActivityMap polyline={details.polyline} />
					</div>
				{/if}

				{#if splits.length > 0}
					<div class="overflow-x-auto overflow-y-auto max-h-[240px] md:shrink-0">
						<table class="text-xs">
							<thead class="sticky top-0 bg-card">
								<tr class="text-text-dim border-b border-card-border">
									<th class="pb-1 pr-3 md:pr-8 text-left font-medium">km <span class="text-text-dim/50">·</span> dist</th>
									<th class="pb-1 pr-3 md:pr-8 text-right font-medium">Pace</th>
									{#if trail}
										<th class="pb-1 pr-3 md:pr-8 text-right font-medium">GAP</th>
									{/if}
									<th class="pb-1 pr-3 md:pr-8 text-right font-medium">HR</th>
									{#if hasElev}
										<th class="pb-1 pr-3 md:pr-8 text-right font-medium">D+</th>
										<th class="pb-1 pr-3 md:pr-8 text-right font-medium">D-</th>
									{/if}
									{#if hasPower}
										<th class="pb-1 pr-3 md:pr-8 text-right font-medium">Pwr</th>
									{/if}
									{#if hasCadence}
										<th class="pb-1 text-right font-medium">Cad</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each splits as split, i}
									{@const cumDist = splits.slice(0, i).reduce((s, x) => s + x.distance_meters, 0)}
									<tr class="border-b border-card-border/20 hover:bg-card-border/10">
										<td class="py-0.5 pr-3 md:pr-8 num text-text-dim whitespace-nowrap">{(cumDist / 1000).toFixed(1)} <span class="text-text-dim/50">·</span> {Math.round(split.distance_meters)}m</td>
										<td class="py-0.5 pr-3 md:pr-8 num text-right text-text">{split.pace?.replace(' /km', '') ?? '-'}</td>
										{#if trail}
											<td class="py-0.5 pr-3 md:pr-8 num text-right text-text-secondary">{splitGaps().get(split.split) ?? '-'}</td>
										{/if}
										<td class="py-0.5 pr-3 md:pr-8 num text-right" style="color: {hrZoneColor(split.avg_hr, hrZones)}">{split.avg_hr || '-'}</td>
										{#if hasElev}
										{@const avgGrade = split.distance_meters > 0 ? (split.elevation_gain - split.elevation_loss) / split.distance_meters * 100 : 0}
											<td class="py-0.5 pr-3 md:pr-8 num text-right" style="color: {gradColor(avgGrade)}"><span class="opacity-50">+</span>{Math.round(split.elevation_gain)}</td>
											<td class="py-0.5 pr-3 md:pr-8 num text-right" style="color: {gradColor(avgGrade)}"><span class="opacity-50">-</span>{Math.round(split.elevation_loss)}</td>
										{/if}
										{#if hasPower}
											<td class="py-0.5 pr-3 md:pr-8 num text-right text-text-secondary">{Math.round(split.avg_power) || '-'}</td>
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
		</div>
	{/if}

	<!-- ═══ CHARTS (Elevation + Performance) ═══ -->
	{#if hasTimeseries && details}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><ChartLine size={12} weight="bold" /> {trail && hasElevTimeseries ? 'Elevation & Performance' : 'Performance'}</h3>
			<ActivityCharts timeseries={details.timeseries} showGap={trail} showElevation={trail && hasElevTimeseries} />
		</div>
	{/if}

	<!-- ═══ METRICS ═══ -->
	{#if advancedMetrics.length > 0}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><Gauge size={12} weight="bold" /> Metrics</h3>
			<div class="flex flex-wrap gap-x-5 gap-y-2">
				{#each advancedMetrics as m}
					<Tip text={m.tip}>
						<div>
							<div class="text-[10px] text-text-dim leading-none">{m.label}</div>
							<div class="num text-xs text-text-secondary mt-0.5">{m.value}</div>
						</div>
					</Tip>
				{/each}
			</div>
		</div>
	{/if}
</div>
