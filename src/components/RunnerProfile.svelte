<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { HillScore, DailyTrainingStatus, EnduranceScore, HrZone } from '$lib/types.js';
	import { AXES, RADAR_AXIS_ORDER, AXIS_COLORS, normalize, formatRaw, computeBalance, computeProductivity } from '$lib/profile.js';
	import { C, CHART_TOOLTIP, ZONE_COLORS, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';

	interface Props {
		hillScore: HillScore;
		currentStatus: DailyTrainingStatus;
		enduranceScore: EnduranceScore;
		vo2max: number;
		statusHistory: DailyTrainingStatus[];       // windowed (for iteration bounds)
		fullStatusHistory: DailyTrainingStatus[];    // full (for rolling 30d computations)
		hillScoreHistory: HillScore[];
		enduranceScoreHistory: EnduranceScore[];
		hrZones: HrZone[];
		maxHr: number | null;
		lactateHr: number | null;
	}

	let { hillScore, currentStatus, enduranceScore, vo2max, statusHistory, fullStatusHistory, hillScoreHistory, enduranceScoreHistory, hrZones, maxHr, lactateHr }: Props = $props();

	let radarEl: HTMLDivElement;

	// Rolling 30-day average of balance scores
	function rolling30dBalance(history: DailyTrainingStatus[], atDate?: string): number {
		const cutoff = atDate
			? new Date(new Date(atDate + 'T00:00:00Z').getTime() - 30 * 86400000).toISOString().slice(0, 10)
			: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
		const endDate = atDate ?? new Date().toISOString().slice(0, 10);
		const window = history.filter(s => s.date >= cutoff && s.date <= endDate);
		const scores = window.map(s => computeBalance(s)).filter(b => b >= 0);
		if (scores.length === 0) return 0;
		return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
	}

	function rawValue(key: string): number {
		switch (key) {
			case 'vo2max': return vo2max;
			case 'endurance': return enduranceScore.score;
			case 'balance': return rolling30dBalance(fullStatusHistory);
			case 'hill': return hillScore.overall;
			case 'productivity': return Math.max(0, computeProductivity(fullStatusHistory));
			default: return 0;
		}
	}

	function peakValues(): number[] {
		const peaks: Record<string, number> = {};
		for (const key of RADAR_AXIS_ORDER) peaks[key] = 0;

		// Iterate windowed dates, but compute rolling 30d from full history
		for (const s of statusHistory) {
			const v = s.vo2max_precise > 0 ? s.vo2max_precise : s.vo2max;
			peaks.vo2max = Math.max(peaks.vo2max, normalize('vo2max', v));
			peaks.balance = Math.max(peaks.balance, rolling30dBalance(fullStatusHistory, s.date));
			const prod = computeProductivity(fullStatusHistory, s.date);
			if (prod >= 0) peaks.productivity = Math.max(peaks.productivity, prod);
		}
		for (const h of hillScoreHistory) {
			peaks.hill = Math.max(peaks.hill, normalize('hill', h.overall));
		}
		for (const e of enduranceScoreHistory) {
			peaks.endurance = Math.max(peaks.endurance, normalize('endurance', e.score));
		}

		return RADAR_AXIS_ORDER.map(key => peaks[key]);
	}

	function floorValues(): number[] {
		const floors: Record<string, number> = {};
		for (const key of RADAR_AXIS_ORDER) floors[key] = 100;

		for (const s of statusHistory) {
			const v = s.vo2max_precise > 0 ? s.vo2max_precise : s.vo2max;
			floors.vo2max = Math.min(floors.vo2max, normalize('vo2max', v));
			floors.balance = Math.min(floors.balance, rolling30dBalance(fullStatusHistory, s.date));
			const prod = computeProductivity(fullStatusHistory, s.date);
			if (prod >= 0) floors.productivity = Math.min(floors.productivity, prod);
		}
		for (const h of hillScoreHistory) {
			floors.hill = Math.min(floors.hill, normalize('hill', h.overall));
		}
		for (const e of enduranceScoreHistory) {
			floors.endurance = Math.min(floors.endurance, normalize('endurance', e.score));
		}

		return RADAR_AXIS_ORDER.map(key => floors[key]);
	}

	const radarData = $derived(() =>
		RADAR_AXIS_ORDER.map(key => {
			const raw = rawValue(key);
			const pct = normalize(key, raw);
			return {
				key,
				axis: AXES[key].name,
				value: pct,
				raw,
				rawStr: formatRaw(key, raw),
			};
		})
	);

	let _chart: any;
	let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(radarEl, undefined, { renderer: 'svg' });
		const rd = radarData();
		const peaks = peakValues();
		const floors = floorValues();

		_chart.setOption({
			radar: {
				indicator: rd.map(d => ({ name: d.axis, max: 100 })),
				shape: 'polygon',
				radius: '68%',
				center: ['50%', '55%'],
				axisName: { color: C.textSecondary, fontSize: 11, fontFamily: MONO },
				axisLine: { lineStyle: { color: C.hover } },
				splitLine: { lineStyle: { color: C.cardBorder } },
				splitArea: { show: false },
			},
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'item',
				formatter: () => rd.map((d, i) => {
					const range = floors[i] !== peaks[i] ? ` · ${floors[i]}–${peaks[i]}%` : '';
					return `<b>${d.axis}: ${d.rawStr}</b> <span style="color:${C.textDim}">(${d.value}%)</span>${range}`;
				}).join('<br/>'),
			},
			series: [{
				type: 'radar',
				data: [
					{
						value: floors,
						name: 'Low',
						areaStyle: { color: 'rgba(239, 68, 68, 0.15)' },
						lineStyle: { color: 'rgba(239, 68, 68, 0.6)', width: 1.5, type: 'dashed' },
						itemStyle: { color: 'rgba(239, 68, 68, 0.6)' },
						symbol: 'circle',
						symbolSize: 3,
						z: 0,
					},
					{
						value: peaks,
						name: 'Peak',
						areaStyle: { color: 'rgba(59, 130, 246, 0.12)' },
						lineStyle: { color: 'rgba(59, 130, 246, 0.5)', width: 1.5, type: 'dashed' },
						itemStyle: { color: 'rgba(59, 130, 246, 0.5)' },
						symbol: 'circle',
						symbolSize: 3,
						z: 1,
					},
					{
						value: rd.map(d => d.value),
						name: 'Current',
						areaStyle: { color: 'transparent' },
						lineStyle: { color: C.blue, width: 2 },
						itemStyle: { color: C.blue },
						symbol: 'circle',
						symbolSize: 6,
						z: 2,
					},
				],
			}],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(radarEl);
	});
</script>

<div class="rounded-lg bg-card p-2 h-full flex flex-col">
	<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] px-2 pt-1">
		{#each RADAR_AXIS_ORDER as key}
			<Tip text={AXES[key].tip}>
				<span class="flex items-center gap-1 text-text-secondary">
					<span class="inline-block w-1.5 h-1.5 rounded-full" style="background:{AXIS_COLORS[key]}"></span>
					{AXES[key].name}
				</span>
			</Tip>
		{/each}
	</div>
	<div class="flex flex-col md:flex-row flex-1 min-h-0">
	<div bind:this={radarEl} class="flex-1 min-h-[220px] w-full"></div>
	{#if hrZones.length > 0}
		<div class="flex md:flex-col items-center md:items-start justify-center gap-2 md:gap-1 px-2 md:pr-2 md:pl-0 shrink-0">
			{#each [1, 2, 3, 4, 5] as z}
				{@const hz = hrZones.find(h => h.zone === z)}
				{#if hz}
					<div class="flex items-center gap-1 md:gap-1.5">
						<div class="w-1 md:w-1.5 h-4 md:h-5 rounded-full" style="background: {ZONE_COLORS[z - 1]};"></div>
						<div class="leading-none text-center md:text-left">
							<span class="num text-[9px] md:text-[10px] font-semibold" style="color: {ZONE_COLORS[z - 1]}">Z{z}</span>
							<span class="num text-[9px] md:text-[10px] text-text-secondary block md:inline md:ml-0.5">{hz.min_bpm}–{#if hz.max_bpm == null}<b class="text-text">{maxHr ?? '?'}</b>{:else}{hz.max_bpm}{/if}</span>
						</div>
					</div>
				{/if}
			{/each}
			{#if lactateHr}
				<Tip text={"Lactate Threshold heart rate.\nThe intensity above which lactate accumulates faster than your body can clear it.\nUsed by Garmin to set your HR zones.\n\nAbove LT = anaerobic, time-limited.\nBelow LT = aerobic, sustainable."}>
					<div class="mt-1 pt-1 border-t border-card-border/30">
						<span class="num text-[10px] text-text-dim">LT</span>
						<span class="num text-[10px] text-text-secondary font-medium ml-0.5">{lactateHr} bpm</span>
					</div>
				</Tip>
			{/if}
		</div>
	{/if}
	</div>
</div>
