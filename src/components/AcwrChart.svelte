<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { DailyTrainingStatus } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import ChartLineUp from 'phosphor-svelte/lib/ChartLineUp';

	interface Props {
		history: DailyTrainingStatus[];
	}

	let { history }: Props = $props();
	let chartEl: HTMLDivElement;

	const SERIES_KEYS = ['acwr', 'acute', 'chronic'] as const;
	type SeriesKey = typeof SERIES_KEYS[number];

	const SERIES_META: Record<SeriesKey, { name: string; color: string; tip: string }> = {
		acwr:    { name: 'ACWR',    color: C.blue,  tip: 'Acute:Chronic Workload Ratio' },
		acute:   { name: 'Acute',   color: C.amber, tip: '7-day acute load' },
		chronic: { name: 'Chronic', color: C.teal,  tip: '28-day chronic load' },
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
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function renderChart() {
		if (!_chart) return;

		const days = history.map(d => d.date.slice(5));
		const acwrValues = hiddenSeries.has('acwr') ? history.map(() => null) : history.map(d => d.acwr);
		const acuteValues = hiddenSeries.has('acute') ? history.map(() => null) : history.map(d => d.acute_load);
		const chronicValues = hiddenSeries.has('chronic') ? history.map(() => null) : history.map(d => d.chronic_load);

		_chart.setOption({
			grid: { top: 8, right: 8, bottom: 30, left: 50 },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					let html = `<b>${params[0].axisValueLabel}</b><br/><table style="border-spacing:8px 1px">`;
					for (const p of params) {
						if (p.value == null) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:2px"></span>`;
						let desc = '';
						if (p.seriesName === 'ACWR') {
							const v = p.value as number;
							const zone = v < 0.8 ? 'low' : v <= 1.3 ? 'optimal' : v <= 1.5 ? 'high' : 'very high';
							desc = `<span style="color:${C.textDim}">${zone}</span>`;
						} else if (p.seriesName === 'Acute') {
							desc = `<span style="color:${C.textDim}">7d</span>`;
						} else if (p.seriesName === 'Chronic') {
							desc = `<span style="color:${C.textDim}">28d</span>`;
						}
						html += `<tr><td>${dot}${p.seriesName}&nbsp;</td><td style="text-align:right"><b>${p.value}</b>&nbsp;</td><td>${desc}</td></tr>`;
					}
					html += '</table>';
					return html;
				},
			},
			legend: { show: false },
			xAxis: {
				type: 'category', data: days,
				...CHART_AXIS,
			},
			yAxis: [
				{
					type: 'value',
					min: 0, max: 2,
					axisLine: { show: false },
					axisLabel: CHART_AXIS.axisLabel,
					splitLine: CHART_AXIS.splitLine,
				},
				{
					type: 'value',
					axisLine: { show: false },
					axisLabel: { show: false },
					splitLine: { show: false },
				},
			],
			series: [
				{
					type: 'line', yAxisIndex: 0, data: acwrValues, name: 'ACWR',
					smooth: true, symbol: 'none',
					lineStyle: { width: 2.5, color: C.blue },
					itemStyle: { color: C.blue },
					markLine: {
						silent: true,
						symbol: 'none',
						label: { position: 'insideEndTop', fontSize: 9, color: C.textDim },
						data: [
							{ yAxis: 0.8, lineStyle: { color: C.green + '50', width: 1, type: 'dashed' }, label: { formatter: '0.8' } },
							{ yAxis: 1.3, lineStyle: { color: C.green + '50', width: 1, type: 'dashed' }, label: { formatter: '1.3' } },
							{ yAxis: 1.5, lineStyle: { color: C.red + '60', width: 1, type: 'dashed' }, label: { formatter: '1.5' } },
						],
					},
				},
				{
					type: 'line', yAxisIndex: 1, data: acuteValues, name: 'Acute',
					smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.amber + '80' },
					itemStyle: { color: C.amber },
				},
				{
					type: 'line', yAxisIndex: 1, data: chronicValues, name: 'Chronic',
					smooth: true, symbol: 'none',
					lineStyle: { width: 1, color: C.teal + '80' },
					itemStyle: { color: C.teal },
				},
			],
		}, true);
	}

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		renderChart();
		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="flex flex-wrap items-center justify-between gap-y-1 mb-2">
		<Tip text={"White line = ACWR (acute ÷ chronic)\n\nDashed green lines = optimal zone (0.8–1.3)\nDashed red line = overreaching threshold (1.5)\n\nDashed amber = 7-day acute load\nSolid teal = 28-day chronic load"}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartLineUp size={14} weight="bold" /> ACWR Trend</h2>
		</Tip>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
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
	<div bind:this={chartEl} class="flex-1 min-h-[160px] w-full"></div>
</div>
