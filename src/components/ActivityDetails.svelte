<script lang="ts">
	import type { Activity, ActivitySplit, ActivityDetails as ActivityDetailsType, ActivityWeather, HrZone } from '$lib/types.js';
	import { formatTime } from '$lib/format.js';
	import { weatherIcon } from '$lib/weather.js';
	import { C, ZONE_COLORS, hrZoneColor, gradColor, derivePowerZones, powerZoneColor } from '$lib/colors.js';
	import Heartbeat from 'phosphor-svelte/lib/Heartbeat';
	import Lightning from 'phosphor-svelte/lib/Lightning';
	import ActivityCharts from './ActivityCharts.svelte';
	import ActivityMap from './ActivityMap.svelte';
	import Tip from './Tip.svelte';
	import Wind from 'phosphor-svelte/lib/Wind';
	import Drop from 'phosphor-svelte/lib/Drop';
	import NoteBlank from 'phosphor-svelte/lib/NoteBlank';
	import Sun from 'phosphor-svelte/lib/Sun';
	import CloudSun from 'phosphor-svelte/lib/CloudSun';
	import Cloud from 'phosphor-svelte/lib/Cloud';
	import CloudRain from 'phosphor-svelte/lib/CloudRain';
	import CloudSnow from 'phosphor-svelte/lib/CloudSnow';
	import CloudFog from 'phosphor-svelte/lib/CloudFog';
	import CloudLightning from 'phosphor-svelte/lib/CloudLightning';
	import Moon from 'phosphor-svelte/lib/Moon';
	import MapPin from 'phosphor-svelte/lib/MapPin';
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
			fetch(`/api/activity/${activity.activity_id}`)
				.then(r => r.ok ? r.json() : null)
				.then(data => { if (data) description = data.description ?? ''; })
				.catch(() => {});
		}
	});

	async function saveDescription() {
		editingDesc = false;
		await fetch(`/api/activity/${activity.activity_id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ description }),
		});
	}

	function speedToPace(speed: number | null): string {
		if (!speed || speed <= 0) return '-';
		const paceSeconds = Math.round(1000 / speed);
		const m = Math.floor(paceSeconds / 60);
		const s = paceSeconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatSplitSeconds(seconds: number | null): string {
		if (!seconds || seconds <= 0) return '-';
		return formatTime(seconds);
	}

	function isTrail(a: Activity): boolean {
		if (!a.elevation_gain_meters || !a.distance_meters || a.distance_meters < 1000) return false;
		return a.elevation_gain_meters / (a.distance_meters / 1000) > 15;
	}


	const trail = $derived(isTrail(activity));

	const zoneTimes = $derived([activity.hr_time_in_zone_1_seconds ?? 0, activity.hr_time_in_zone_2_seconds ?? 0, activity.hr_time_in_zone_3_seconds ?? 0, activity.hr_time_in_zone_4_seconds ?? 0, activity.hr_time_in_zone_5_seconds ?? 0]);
	const zoneTotal = $derived(zoneTimes.reduce((s, v) => s + v, 0));

	const powerZoneTimes = $derived([activity.power_time_in_zone_1_seconds ?? 0, activity.power_time_in_zone_2_seconds ?? 0, activity.power_time_in_zone_3_seconds ?? 0, activity.power_time_in_zone_4_seconds ?? 0, activity.power_time_in_zone_5_seconds ?? 0]);
	const powerZoneTotal = $derived(powerZoneTimes.reduce((s, v) => s + v, 0));
	// Reverse-engineer power-zone boundaries (in watts) from the timeseries
	// + Garmin's per-zone time counts. Used to color split power values.
	const powerZoneBoundaries = $derived(
		details ? derivePowerZones(details.timeseries.map(p => p.power), powerZoneTimes) : []
	);

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
	// Strength / yoga / cardio sessions don't have GPS, splits, or pace — gate
	// the distance-flavoured panels (Map & Splits, Performance chart, advanced
	// metrics) on this. HR / load / zones still apply and stay visible.
	const hasDistance = $derived(activity.distance_meters != null && activity.distance_meters > 0);
	const hasMap = $derived(details != null && details.polyline.length > 1);
	const hasTimeseries = $derived(details != null && details.timeseries.length > 5);
	const hasElev = $derived(splits.some(s => s.elevation_gain_meters > 0));
	const hasPower = $derived(splits.some(s => (s.average_power ?? 0) > 0));
	const hasCadence = $derived(splits.some(s => (s.average_run_cadence ?? 0) > 0));
	const hasElevTimeseries = $derived(details != null && details.timeseries.some(p => p.elev != null));

	const advancedMetrics = $derived(([
		activity.fastest_split_1000_seconds ? { label: 'Best 1km', value: formatSplitSeconds(activity.fastest_split_1000_seconds), tip: 'Fastest 1km split in this activity.' } : null,
		activity.fastest_split_5000_seconds ? { label: 'Best 5km', value: formatSplitSeconds(activity.fastest_split_5000_seconds), tip: 'Fastest 5km split in this activity.\nOnly meaningful for runs longer than 5km.' } : null,
		(() => { const cs = splits.filter(s => (s.average_run_cadence ?? 0) > 0 && s.duration_seconds > 0); if (cs.length === 0) return null; const totalDur = cs.reduce((s, x) => s + x.duration_seconds, 0); const avg = cs.reduce((s, x) => s + (x.average_run_cadence ?? 0) * x.duration_seconds, 0) / totalDur; return { label: 'Cadence', value: Math.round(avg) + ' spm', tip: 'Average cadence (steps per minute), weighted by split duration.' }; })(),
		activity.avg_stride_length_cm ? { label: 'Stride', value: (activity.avg_stride_length_cm / 100).toFixed(2) + 'm', tip: 'Average stride length.\nLonger strides at the same cadence = faster pace.' } : null,
		activity.avg_ground_contact_time_ms ? { label: 'GCT', value: Math.round(activity.avg_ground_contact_time_ms) + 'ms', tip: 'Ground Contact Time — how long your foot stays on the ground per step.\nLower is generally better (elite ~200ms, recreational ~280ms+).' } : null,
		activity.avg_vertical_oscillation_cm ? { label: 'Vert Osc', value: activity.avg_vertical_oscillation_cm.toFixed(1) + 'cm', tip: 'Vertical Oscillation — how much you bounce per step.\nLess bounce = more efficient running.' } : null,
		activity.avg_vertical_ratio_percent ? { label: 'Vert Ratio', value: activity.avg_vertical_ratio_percent.toFixed(1) + '%', tip: 'Vertical Ratio — vertical oscillation divided by stride length.\nLower = more horizontal movement per step = better economy.' } : null,
		activity.calories ? { label: 'Calories', value: String(activity.calories), tip: 'Estimated energy expenditure.\nBased on HR, weight, and duration. Approximate.' } : null,
		activity.difference_body_battery != null ? { label: 'BB delta', value: (activity.difference_body_battery > 0 ? '+' : '') + activity.difference_body_battery, tip: 'Body Battery drained by this session.\nShows the physiological cost of the workout.' } : null,
		activity.elevation_loss_meters ? { label: 'D-', value: activity.elevation_loss_meters + 'm', tip: 'Total descent during this activity.' } : null,
	]).filter(Boolean) as { label: string; value: string; tip: string }[]);
</script>

<div class="border-t border-card-border/50 px-3 md:px-4 py-4 space-y-5">

	<!-- ═══ NOTE ═══ -->
	<div>
		<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><NoteBlank size={12} weight="bold" /> Note</h3>
		{#if editingDesc}
			<!-- svelte-ignore a11y_autofocus -->
			<textarea
				class="w-full bg-card-border/20 rounded text-xs text-text-secondary p-2 outline-none border border-card-border/50 focus:border-blue-500/50 resize-none whitespace-pre-line"
				rows="3"
				bind:value={description}
				onblur={saveDescription}
				onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') { editingDesc = false; } }}
				autofocus
			></textarea>
		{:else}
			<button
				class="block w-full text-left cursor-pointer text-xs whitespace-pre-line transition-colors {description ? 'text-text hover:text-text-secondary' : 'text-text-dim hover:text-text-secondary'}"
				onclick={() => editingDesc = true}
			>{description || 'add a note...'}</button>
		{/if}
	</div>

	<!-- ═══ WEATHER ═══ -->
	{#if weather && hasDistance}
		{@const temp = Math.round(weather.temperature_celsius ?? 0)}
		{@const feels = Math.round(weather.feels_like_celsius ?? 0)}
		{@const wt = weatherIcon(weather.weather_description)}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><CloudSun size={12} weight="bold" /> Weather</h3>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
				<span class="flex items-center gap-1 text-text">
					{#if wt === 'sun'}<Sun size={14} weight="bold" />
					{:else if wt === 'cloud-sun'}<CloudSun size={14} weight="bold" />
					{:else if wt === 'cloud'}<Cloud size={14} weight="bold" />
					{:else if wt === 'rain'}<CloudRain size={14} weight="bold" />
					{:else if wt === 'snow'}<CloudSnow size={14} weight="bold" />
					{:else if wt === 'fog'}<CloudFog size={14} weight="bold" />
					{:else if wt === 'storm'}<CloudLightning size={14} weight="bold" />
					{:else}<Moon size={14} weight="bold" />
					{/if}
					<span class="num">{temp}°C</span>
					{#if feels !== temp}
						<span class="text-text-dim">feels {feels}°</span>
					{/if}
				</span>
				<span class="flex items-center gap-1"><Wind size={12} weight="bold" /> <span class="num">{Math.round(weather.wind_speed_kmh ?? 0)} km/h {weather.wind_direction_compass_point}</span></span>
				<span class="flex items-center gap-1"><Drop size={12} weight="bold" /> <span class="num">{Math.round(weather.relative_humidity ?? 0)}%</span></span>
				<span class="text-text-secondary">{weather.weather_description}</span>
			</div>
		</div>
	{/if}

	<!-- ═══ HR ZONES + POWER ZONES — stacked on phone, side-by-side on desktop ═══ -->
	{#snippet zoneRow(z: number, time: number, total: number, range: string | null)}
		{@const pct = total > 0 ? time / total * 100 : 0}
		{#if time > 0}
			<div class="flex items-center gap-2 text-xs">
				<span class="num font-semibold w-5 shrink-0" style="color: {ZONE_COLORS[z - 1]}">Z{z}</span>
				<div class="flex-1 h-1.5 rounded-full bg-card-border overflow-hidden">
					<div class="h-full rounded-full" style="width: {pct}%; background: {ZONE_COLORS[z - 1]};"></div>
				</div>
				<span class="num text-text-secondary w-8 text-right shrink-0">{Math.round(pct)}%</span>
				<span class="num text-text-dim w-12 text-right shrink-0">{Math.floor(time / 60)}:{Math.floor(time % 60).toString().padStart(2, '0')}</span>
				{#if range}<span class="num text-text-dim text-[10px] w-16 text-right shrink-0 hidden sm:inline">{range}</span>{/if}
			</div>
		{/if}
	{/snippet}

	{#if zoneTotal > 0 || powerZoneTotal > 0}
		<div class="grid gap-5 md:grid-cols-2">
			{#if zoneTotal > 0}
				<div>
					<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><Heartbeat size={12} weight="bold" /> HR Zones</h3>
					<div class="flex flex-col gap-1.5">
						{#each [1, 2, 3, 4, 5] as z}
							{@const hz = hrZones.find(h => h.zone === z)}
							{@render zoneRow(z, zoneTimes[z - 1], zoneTotal, hz ? `${hz.min_bpm}–${hz.max_bpm ?? '∞'}` : null)}
						{/each}
					</div>
				</div>
			{/if}
			{#if powerZoneTotal > 0}
				<div>
					<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><Lightning size={12} weight="bold" /> Power Zones</h3>
					<div class="flex flex-col gap-1.5">
						{#each [1, 2, 3, 4, 5] as z}
							{@const lo = z === 1 ? 0 : powerZoneBoundaries[z - 2]}
							{@const hi = z === 5 ? null : powerZoneBoundaries[z - 1]}
							{@const range = powerZoneBoundaries.length === 4
								? (hi != null ? `${Math.round(lo)}–${Math.round(hi)}W` : `${Math.round(lo)}+W`)
								: null}
							{@render zoneRow(z, powerZoneTimes[z - 1], powerZoneTotal, range)}
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ═══ MAP + SPLITS ═══ -->
	{#if hasDistance && (hasMap || splits.length > 0)}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><MapPin size={12} weight="bold" /> Map & Splits</h3>
			<div class="flex flex-col md:flex-row gap-4">
				{#if hasMap && details}
					<div class="h-[200px] md:h-auto md:self-stretch md:flex-1 md:min-w-0 rounded overflow-hidden border border-card-border/50">
						<ActivityMap polyline={details.polyline} />
					</div>
				{/if}

				{#if splits.length > 0}
					<div class="overflow-auto max-h-[240px] md:max-h-none md:overflow-visible w-full md:w-auto md:shrink-0">
						<table class="text-xs w-full md:w-auto">
							<thead class="sticky top-0 bg-card">
								<tr class="text-text-dim border-b border-card-border">
									<th class="pb-1 pr-3 md:pr-4 text-left font-medium">km <span class="text-text-dim/50">·</span> dist</th>
									<th class="pb-1 pr-3 md:pr-4 text-right font-medium">Pace</th>
									{#if trail}
										<th class="pb-1 pr-3 md:pr-4 text-right font-medium">GAP</th>
									{/if}
									<th class="pb-1 pr-3 md:pr-4 text-right font-medium">HR</th>
									{#if hasElev}
										<th class="pb-1 pr-3 md:pr-4 text-right font-medium">D+</th>
										<th class="pb-1 pr-3 md:pr-4 text-right font-medium">D-</th>
									{/if}
									{#if hasPower}
										<th class="pb-1 pr-3 md:pr-4 text-right font-medium">Pwr</th>
									{/if}
									{#if hasCadence}
										<th class="pb-1 text-right font-medium">Cad</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each splits as split, i}
									{@const cumDist = splits.slice(0, i).reduce((s, x) => s + x.distance_meters, 0)}
									{@const paceSec = split.distance_meters > 0 && split.duration_seconds > 0 ? Math.round(split.duration_seconds / (split.distance_meters / 1000)) : null}
									<tr class="border-b border-card-border/20 hover:bg-card-border/10">
										<td class="py-0.5 pr-3 md:pr-4 num text-text-dim whitespace-nowrap">{(cumDist / 1000).toFixed(1)} <span class="text-text-dim/50">·</span> {Math.round(split.distance_meters)}m</td>
										<td class="py-0.5 pr-3 md:pr-4 num text-right text-text">{paceSec ? `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, '0')}` : '-'}</td>
										{#if trail}
											<td class="py-0.5 pr-3 md:pr-4 num text-right text-text-secondary">{splitGaps().get(split.split) ?? '-'}</td>
										{/if}
										<td class="py-0.5 pr-3 md:pr-4 num text-right" style="color: {hrZoneColor(split.average_hr, hrZones)}">{split.average_hr || '-'}</td>
										{#if hasElev}
										{@const avgGrade = split.distance_meters > 0 ? (split.elevation_gain_meters - split.elevation_loss_meters) / split.distance_meters * 100 : 0}
											<td class="py-0.5 pr-3 md:pr-4 num text-right" style="color: {gradColor(avgGrade)}"><span class="opacity-50">+</span>{Math.round(split.elevation_gain_meters)}</td>
											<td class="py-0.5 pr-3 md:pr-4 num text-right" style="color: {gradColor(avgGrade)}"><span class="opacity-50">-</span>{Math.round(split.elevation_loss_meters)}</td>
										{/if}
										{#if hasPower}
											<td class="py-0.5 pr-3 md:pr-4 num text-right" style="color: {powerZoneColor(split.average_power, powerZoneBoundaries)}">{Math.round(split.average_power ?? 0) || '-'}</td>
										{/if}
										{#if hasCadence}
											<td class="py-0.5 num text-right text-text-secondary">{Math.round(split.average_run_cadence ?? 0) || '-'}</td>
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
	{#if hasDistance && hasTimeseries && details}
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
