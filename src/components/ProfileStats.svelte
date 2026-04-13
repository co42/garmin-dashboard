<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { RacePredictions, PersonalRecord, Activity } from '$lib/types.js';
	import { formatTime } from '$lib/format.js';
	import { C, CHART_TOOLTIP, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Timer from 'phosphor-svelte/lib/Timer';
	import Trophy from 'phosphor-svelte/lib/Trophy';
	import TrendUp from 'phosphor-svelte/lib/TrendUp';

	interface Props {
		predictions: RacePredictions;
		records: PersonalRecord[];
		activities?: Activity[];
		history?: RacePredictions[];
		onNavigate?: (activityId: number) => void;
	}

	let { predictions, records, activities = [], history = [], onNavigate }: Props = $props();
	const activityMap = $derived(new Map(activities.map(a => [a.id, a])));

	type TimeKey = 'time_5k_seconds' | 'time_10k_seconds' | 'time_half_marathon_seconds' | 'time_marathon_seconds';

	const DISTANCES: { label: string; km: number; recordType: string; predTime: number; predTimeStr: string; predPace: string; timeKey: TimeKey }[] = $derived([
		{ label: '5K', km: 5, recordType: '5K Run', predTime: predictions.time_5k_seconds, predTimeStr: predictions.time_5k, predPace: predictions.pace_5k, timeKey: 'time_5k_seconds' },
		{ label: '10K', km: 10, recordType: '10K Run', predTime: predictions.time_10k_seconds, predTimeStr: predictions.time_10k, predPace: predictions.pace_10k, timeKey: 'time_10k_seconds' },
		{ label: 'Semi', km: 21.0975, recordType: 'Half Marathon', predTime: predictions.time_half_marathon_seconds, predTimeStr: predictions.time_half_marathon, predPace: predictions.pace_half_marathon, timeKey: 'time_half_marathon_seconds' },
		{ label: 'Marathon', km: 42.195, recordType: 'Full Marathon', predTime: predictions.time_marathon_seconds, predTimeStr: predictions.time_marathon, predPace: predictions.pace_marathon, timeKey: 'time_marathon_seconds' },
	]);

	const recordMap = $derived(new Map(records.map(r => [r.record_type, r])));

	function pace(seconds: number, km: number): string {
		const p = seconds / km;
		return `${Math.floor(p / 60)}:${Math.floor(p % 60).toString().padStart(2, '0')} /km`;
	}

	function paceFmt(seconds: number, km: number): string {
		const p = seconds / km;
		return `${Math.floor(p / 60)}:${Math.floor(p % 60).toString().padStart(2, '0')}/km`;
	}

	function yearLabel(date: string): string {
		const d = new Date(date.includes('T') ? date : date.slice(0, 10) + 'T12:00:00Z');
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
	}

	function isRecent(date: string): boolean {
		return Date.now() - new Date(date.slice(0, 10) + 'T12:00:00Z').getTime() < 30 * 86400000;
	}

	// --- Sparkline charts (echarts) ---
	let _echarts: any = null;
	let _charts = new Map<number, any>();
	let _ros: ResizeObserver[] = [];

	onDestroy(() => {
		for (const ro of _ros) ro.disconnect();
		for (const ch of _charts.values()) ch?.dispose();
	});

	function renderSparkline(idx: number) {
		const chart = _charts.get(idx);
		if (!chart || idx >= DISTANCES.length) return;
		const dist = DISTANCES[idx];
		const key = dist.timeKey;

		const filtered = history.filter(h => h[key] > 0);
		if (filtered.length < 2) { chart.clear(); return; }

		const dates = filtered.map(h => {
			const dt = new Date(h.date.slice(0, 10) + 'T12:00:00Z');
			return `${dt.getUTCDate()} ${dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
		});
		const values = filtered.map(h => h[key]);
		const km = dist.km;

		chart.setOption({
			grid: { top: 2, right: 0, bottom: 2, left: 0 },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					const p = params[0];
					if (p.value == null) return '';
					const secs = p.value as number;
					return `<b>${p.axisValueLabel}</b><br/><table style="border-spacing:8px 1px"><tr><td style="color:${C.textDim}">Time&nbsp;</td><td style="text-align:right"><b>${formatTime(secs)}</b></td></tr><tr><td style="color:${C.textDim}">Pace&nbsp;</td><td style="text-align:right"><b>${paceFmt(secs, km)}</b></td></tr></table>`;
				},
			},
			xAxis: { type: 'category', data: dates, show: false },
			yAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
			series: [{
				type: 'line',
				data: values,
				smooth: true,
				symbol: 'none',
				lineStyle: { width: 1.5, color: C.blue },
				itemStyle: { color: C.blue },
			}],
		}, true);
	}

	function initSparkline(el: HTMLElement, idx: number) {
		(async () => {
			if (!_echarts) _echarts = await import('echarts');
			const chart = _echarts.init(el, undefined, { renderer: 'svg' });
			_charts.set(idx, chart);
			renderSparkline(idx);
			const ro = new ResizeObserver(() => chart.resize());
			ro.observe(el);
			_ros.push(ro);
		})();

		return {
			destroy() {
				const chart = _charts.get(idx);
				chart?.dispose();
				_charts.delete(idx);
			},
		};
	}

	$effect(() => {
		const _h = history;
		for (const idx of _charts.keys()) renderSparkline(idx);
	});
</script>

<div>
	<div class="mt-4 mb-3">
		<Tip text={"PR = your actual best time from a real run.\nPredicted = Garmin estimate from current VO2max — tracks current fitness, drops when you detrain."}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Timer size={14} weight="bold" /> Race Times</h2>
		</Tip>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
		{#each DISTANCES as dist, i}
			{@const pr = recordMap.get(dist.recordType)}
			{@const recent = pr?.date ? isRecent(pr.date) : false}
			{@const prActivity = pr?.activity_id ? activityMap.get(pr.activity_id) : undefined}
			{@const location = prActivity?.location_name}
			<div class="rounded-lg bg-card px-3 md:px-4 py-3" style={recent ? 'box-shadow: 0 0 0 1px rgba(34,197,94,0.3);' : ''}>
				<div class="mb-2 flex items-baseline justify-between gap-2 min-w-0">
					<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary shrink-0">{dist.label}</span>
					{#if pr?.date}
						{#if pr.activity_id && onNavigate}
							<button type="button" class="num text-[10px] text-text-dim cursor-pointer hover:text-text-secondary transition-colors truncate min-w-0" onclick={() => onNavigate(pr.activity_id!)}>{#if location}<span class="text-text-secondary">{location}</span>&nbsp;·&nbsp;{/if}{yearLabel(pr.date)}{#if recent}<span style="color: {C.green}"> NEW</span>{/if}</button>
						{:else}
							<span class="num text-[10px] text-text-dim truncate min-w-0">{#if location}<span class="text-text-secondary">{location}</span>&nbsp;·&nbsp;{/if}{yearLabel(pr.date)}{#if recent}<span style="color: {C.green}"> NEW</span>{/if}</span>
						{/if}
					{/if}
				</div>

			{#if pr}
					<div class="flex items-center gap-2">
						<Trophy size={16} weight="bold" class="text-text-dim shrink-0" />
						<span class="num text-lg font-bold text-text">{pr.formatted_value}</span>
						<span class="num text-sm text-text-secondary ml-auto">{(pr.pace_min_km ?? pace(pr.value, dist.km)).replace(' /km', '/km')}</span>
					</div>
				{:else}
					<div class="flex items-center gap-2 text-sm text-text-dim"><Trophy size={16} weight="bold" class="shrink-0" /> no PR</div>
				{/if}

				<div class="mt-2 border-t border-card-border/50 pt-2">
					<div class="flex items-center gap-2">
						<TrendUp size={16} weight="bold" class="text-text-dim shrink-0" />
						<span class="num text-lg font-bold text-text-dim">{dist.predTimeStr}</span>
						<span class="num text-sm text-text-dim ml-auto">{dist.predPace}/km</span>
					</div>
					<div use:initSparkline={i} class="h-[40px] mt-1" style="margin-left:-0.75rem;margin-right:-0.75rem;width:calc(100% + 1.5rem)"></div>
				</div>
			</div>
		{/each}
	</div>
</div>
