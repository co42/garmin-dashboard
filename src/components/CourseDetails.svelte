<script lang="ts">
	import type { Course, ActivityDetailPoint } from '$lib/types.js';
	import { formatDistance } from '$lib/format.js';
	import { C, gradColor, arrMin, arrMax } from '$lib/colors.js';
	import ElevationChart from './ElevationChart.svelte';
	import ActivityMap from './ActivityMap.svelte';
	import Tip from './Tip.svelte';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import Gauge from 'phosphor-svelte/lib/Gauge';

	interface Props {
		course: Course;
	}

	let { course }: Props = $props();

	const hasGeoPoints = $derived(course.geo_points.length > 1);

	// Convert course geo_points to ActivityDetailPoint[] for ElevationChart
	const timeseries = $derived<ActivityDetailPoint[]>(
		course.geo_points.map(p => ({
			dist: p.distance_meters,
			elev: p.elevation_meters,
			hr: null,
			pace: null,
			power: null,
			cadence: null,
			gap: null,
			lat: p.latitude,
			lon: p.longitude,
		}))
	);

	// Convert to polyline for ActivityMap
	const polyline = $derived<[number, number][]>(
		course.geo_points.map(p => [p.latitude, p.longitude])
	);

	const hasElevation = $derived(
		course.geo_points.some(p => p.elevation_meters != null && p.elevation_meters > 0)
	);

	// Compute metrics from geo_points
	const elevStats = $derived(() => {
		if (!hasElevation) return null;
		const elevs = course.geo_points.filter(p => p.elevation_meters != null).map(p => p.elevation_meters);
		if (elevs.length === 0) return null;
		const min = arrMin(elevs);
		const max = arrMax(elevs);
		const start = elevs[0];
		const end = elevs[elevs.length - 1];
		return { min, max, start, end, range: max - min };
	});

	// Per-km elevation table from geo_points
	const kmSplits = $derived(() => {
		if (course.geo_points.length < 2) return [];
		const splits: { km: number; dist: number; elevGain: number; elevLoss: number; minElev: number; maxElev: number }[] = [];
		let currentKm = 1;
		let gain = 0, loss = 0;
		let minE = Infinity, maxE = -Infinity;
		let prevDist = 0;
		for (let i = 1; i < course.geo_points.length; i++) {
			const prev = course.geo_points[i - 1];
			const curr = course.geo_points[i];
			const diff = (curr.elevation_meters ?? 0) - (prev.elevation_meters ?? 0);
			if (diff > 0) gain += diff;
			else loss += Math.abs(diff);
			if (curr.elevation_meters != null) {
				if (curr.elevation_meters < minE) minE = curr.elevation_meters;
				if (curr.elevation_meters > maxE) maxE = curr.elevation_meters;
			}
			if (curr.distance_meters / 1000 >= currentKm || i === course.geo_points.length - 1) {
				splits.push({
					km: currentKm,
					dist: curr.distance_meters - prevDist,
					elevGain: Math.round(gain),
					elevLoss: Math.round(loss),
					minElev: Math.round(minE),
					maxElev: Math.round(maxE),
				});
				currentKm++;
				prevDist = curr.distance_meters;
				gain = 0;
				loss = 0;
				minE = Infinity;
				maxE = -Infinity;
			}
		}
		return splits;
	});

	const metrics = $derived(([
		{ label: 'Distance', value: formatDistance(course.distance_meters) + ' km' },
		{ label: 'D+', value: Math.round(course.elevation_gain_meters) + 'm' },
		{ label: 'D-', value: Math.round(course.elevation_loss_meters) + 'm' },
		elevStats() ? { label: 'Min elev', value: Math.round(elevStats()!.min) + 'm' } : null,
		elevStats() ? { label: 'Max elev', value: Math.round(elevStats()!.max) + 'm' } : null,
		elevStats() ? { label: 'Start elev', value: Math.round(elevStats()!.start) + 'm' } : null,
		elevStats() ? { label: 'End elev', value: Math.round(elevStats()!.end) + 'm' } : null,
		course.distance_meters > 0 ? { label: 'D+/km', value: Math.round(course.elevation_gain_meters / (course.distance_meters / 1000)) + 'm/km' } : null,
		course.geo_points.length > 0 ? { label: 'Track pts', value: String(course.geo_points.length) } : null,
	]).filter(Boolean) as { label: string; value: string }[]);
</script>

<div class="border-t border-card-border/50 px-3 md:px-4 py-4 space-y-5">

	<!-- ═══ MAP + SPLITS ═══ -->
	{#if hasGeoPoints}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><MapPin size={12} weight="bold" /> Map & Splits</h3>
			<div class="flex flex-col md:flex-row gap-4">
				<div class="h-[200px] md:h-auto md:self-stretch md:flex-1 md:min-w-0 rounded overflow-hidden border border-card-border/50">
					<ActivityMap {polyline} />
				</div>

				{#if kmSplits().length > 0}
					<div class="overflow-auto max-h-[240px] md:max-h-none md:overflow-visible w-full md:w-auto md:shrink-0">
						<table class="text-xs w-full md:w-auto">
							<thead class="sticky top-0 bg-card">
								<tr class="text-text-dim border-b border-card-border">
									<th class="pb-1 pr-3 md:pr-4 text-left font-medium">km</th>
									<th class="pb-1 pr-3 md:pr-4 text-right font-medium">D+</th>
									<th class="pb-1 pr-3 md:pr-4 text-right font-medium">D-</th>
									<th class="pb-1 pr-3 md:pr-4 text-right font-medium">Min</th>
									<th class="pb-1 text-right font-medium">Max</th>
								</tr>
							</thead>
							<tbody>
								{#each kmSplits() as split}
									{@const avgGrade = split.dist > 0 ? (split.elevGain - split.elevLoss) / split.dist * 100 : 0}
									<tr class="border-b border-card-border/20 hover:bg-card-border/10">
										<td class="py-0.5 pr-3 md:pr-4 num text-text-dim">{split.km}</td>
										<td class="py-0.5 pr-3 md:pr-4 num text-right" style="color: {gradColor(avgGrade)}"><span class="opacity-50">+</span>{split.elevGain}</td>
										<td class="py-0.5 pr-3 md:pr-4 num text-right" style="color: {gradColor(avgGrade)}"><span class="opacity-50">-</span>{split.elevLoss}</td>
										<td class="py-0.5 pr-3 md:pr-4 num text-right text-text-secondary">{split.minElev}m</td>
										<td class="py-0.5 num text-right text-text-secondary">{split.maxElev}m</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ═══ ELEVATION ═══ -->
	{#if hasGeoPoints && hasElevation}
		<div>
			<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><Mountains size={12} weight="bold" /> Elevation</h3>
			<ElevationChart {timeseries} />
		</div>
	{/if}

	<!-- ═══ METRICS ═══ -->
	<div>
		<h3 class="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-dim"><Gauge size={12} weight="bold" /> Metrics</h3>
		<div class="flex flex-wrap gap-x-5 gap-y-2">
			{#each metrics as m}
				<div>
					<div class="text-[10px] text-text-dim leading-none">{m.label}</div>
					<div class="num text-xs text-text-secondary mt-0.5">{m.value}</div>
				</div>
			{/each}
		</div>
	</div>
</div>
