<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { HrvDay } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO, hrvStatusColor } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Heartbeat from 'phosphor-svelte/lib/Heartbeat';

	interface Props {
		hrv: HrvDay[];
	}

	let { hrv }: Props = $props();
	let chartEl: HTMLDivElement;

	const SERIES_KEYS = ['lastNight', 'weeklyAvg', 'baseline'] as const;
	type SeriesKey = typeof SERIES_KEYS[number];

	const SERIES_META: Record<SeriesKey, { name: string; color: string; tip: string }> = {
		lastNight: { name: 'Last night', color: C.amber,  tip: 'Last night average HRV' },
		weeklyAvg: { name: 'Weekly avg', color: C.blue,   tip: 'Rolling 7-day average — Garmin bases status on this' },
		baseline:  { name: 'Baseline',   color: C.green,  tip: 'Personal baseline corridor' },
	};

	let hiddenSeries = $state(new Set<SeriesKey>());

	function toggleSeries(key: SeriesKey) {
		const next = new Set(hiddenSeries);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		hiddenSeries = next;
		renderChart();
	}

	let _chart: any; let _ro: ResizeObserver;
	let _ready = $state(false);
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function renderChart() {
		if (!_chart) return;

		const dates = hrv.map(d => d.date.slice(5, 10));
		const lastNightValues = hrv.map(d => d.last_night_avg ?? d.weekly_average);
		const weeklyValues = hrv.map(d => d.weekly_average);
		const statuses = hrv.map(d => d.status);

		const corridorLow = hrv.map((d, i) => {
			if (d.baseline_balanced_low != null) return d.baseline_balanced_low;
			const window = lastNightValues.slice(Math.max(0, i - 6), i + 1);
			return Math.round(window.reduce((s, v) => s + v, 0) / window.length - 5);
		});
		const corridorHigh = hrv.map((d, i) => {
			if (d.baseline_balanced_upper != null) return d.baseline_balanced_upper;
			const window = lastNightValues.slice(Math.max(0, i - 6), i + 1);
			return Math.round(window.reduce((s, v) => s + v, 0) / window.length + 5);
		});

		const hideNight = hiddenSeries.has('lastNight');
		const hideWeekly = hiddenSeries.has('weeklyAvg');
		const hideBaseline = hiddenSeries.has('baseline');
		const nil = hrv.map(() => null);

		_chart.setOption({
			grid: { top: 8, right: 0, bottom: 30, left: 0 },
			legend: { show: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter(params: any) {
					const idx = params[0]?.dataIndex ?? 0;
					const d = hrv[idx];
					const statusColor = hrvStatusColor(d?.status ?? '');
					let html = `<b>${dates[idx]}</b><br/><table style="border-spacing:8px 1px">`;
					html += `<tr><td>Last night&nbsp;</td><td style="text-align:right"><b>${lastNightValues[idx]}</b>&nbsp;</td><td style="color:${C.textDim}">ms</td></tr>`;
					if (d?.last_night_5min_high != null) html += `<tr><td>5-min high&nbsp;</td><td style="text-align:right">${d.last_night_5min_high}&nbsp;</td><td style="color:${C.textDim}">ms</td></tr>`;
					html += `<tr><td>Weekly avg&nbsp;</td><td style="text-align:right"><b>${d?.weekly_average ?? '-'}</b>&nbsp;</td><td style="color:${C.textDim}">ms</td></tr>`;
					html += `<tr><td>Baseline&nbsp;</td><td style="text-align:right">${corridorLow[idx]}–${corridorHigh[idx]}&nbsp;</td><td style="color:${C.textDim}">ms</td></tr>`;
					html += `<tr><td>Status&nbsp;</td><td style="text-align:right;color:${statusColor}" colspan="2"><b>${statuses[idx]}</b></td></tr>`;
					html += '</table>';
					return html;
				},
			},
			xAxis: {
				type: 'category', data: dates, boundaryGap: false,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, showMinLabel: false, showMaxLabel: false },
			},
			yAxis: {
				type: 'value',
				min: (v: { min: number }) => Math.floor(v.min - 3),
				axisLine: { show: false },
				axisLabel: { show: false },
				splitLine: CHART_AXIS.splitLine,
			},
			series: [
				{
					type: 'line', name: '_bandMin', data: hideBaseline ? nil : corridorLow,
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: 'transparent' },
					z: 1,
				},
				{
					type: 'line', name: '_bandMax', data: hideBaseline ? nil : corridorHigh.map((v, i) => v - corridorLow[i]),
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: C.green + '18' },
					z: 1,
				},
				{
					type: 'line', name: 'Weekly avg', data: hideWeekly ? nil : weeklyValues, smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.blue },
					itemStyle: { color: C.blue },
					z: 3,
				},
				{
					type: 'line', name: 'Last night', data: hideNight ? nil : lastNightValues, smooth: true, symbol: 'none',
					lineStyle: { width: 1.5, color: C.amber + '80' },
					itemStyle: { color: C.amber },
					z: 2,
				},
			],
		}, true);
	}

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
		_ready = true;
	});

	$effect(() => {
		if (!_ready) return;
		hrv; hiddenSeries;
		renderChart();
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="flex flex-wrap items-center justify-between gap-y-1 mb-2">
		<Tip text={"Heart Rate Variability — variation between heartbeats.\nHigher = more recovered nervous system.\n\nAmber = last night reading (volatile)\nBlue = 7-day rolling average (Garmin bases status on this)\nDashed green = personal baseline corridor"}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Heartbeat size={14} weight="bold" /> HRV</h2>
		</Tip>
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
			{#each SERIES_KEYS as key}
				<Tip text={SERIES_META[key].tip}>
					<button
						class="flex items-center gap-1 cursor-pointer transition-opacity {hiddenSeries.has(key) ? 'opacity-30' : 'text-text-secondary'}"
						onclick={() => toggleSeries(key)}
					>
						<span class="inline-block w-2.5 h-0.5 rounded-full" style="background:{SERIES_META[key].color}"></span>
						{SERIES_META[key].name}
					</button>
				</Tip>
			{/each}
		</div>
	</div>
	<div bind:this={chartEl} class="flex-1 min-h-[140px] w-full"></div>
</div>
