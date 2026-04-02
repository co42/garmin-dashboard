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

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		const days = history.map(d => d.date.slice(5));
		const acwrValues = history.map(d => d.acwr);
		const acuteValues = history.map(d => d.acute_load);
		const chronicValues = history.map(d => d.chronic_load);

		_chart.setOption({
			grid: { top: 40, right: 8, bottom: 30, left: 50 },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					let html = `<b>${params[0].axisValueLabel}</b><table style="border-spacing:6px 1px">`;
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
			legend: {
				data: [
					{ name: 'ACWR', itemStyle: { color: C.blue } },
					{ name: 'Acute', itemStyle: { color: C.amber } },
					{ name: 'Chronic', itemStyle: { color: C.teal } },
				],
				top: 6,
				textStyle: { color: C.textSecondary, fontSize: 11, fontFamily: MONO },
			},
			xAxis: {
				type: 'category', data: days,
				...CHART_AXIS,
			},
			yAxis: [
				{
					type: 'value', name: 'ACWR',
					nameTextStyle: { color: C.textDim, fontSize: 10 },
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
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text={"White line = ACWR (acute ÷ chronic)\n\nDashed green lines = optimal zone (0.8–1.3)\nDashed red line = overreaching threshold (1.5)\n\nDashed amber = 7-day acute load\nSolid blue = 28-day chronic load"}>
		<h2 class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartLineUp size={14} weight="bold" /> ACWR Trend</h2>
	</Tip>
	<div bind:this={chartEl} class="h-[260px] w-full"></div>
</div>
