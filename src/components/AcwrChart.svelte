<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { DailyTrainingStatus } from '$lib/types.js';
	import Tip from './Tip.svelte';

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
			grid: { top: 40, right: 60, bottom: 30, left: 50 },
			tooltip: {
				trigger: 'axis',
				confine: true,
				backgroundColor: '#1e1e2a',
				borderColor: '#2a2a3a',
				textStyle: { color: '#e8e8ed', fontSize: 12 },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					let html = `<b>${params[0].axisValueLabel}</b><br/>`;
					for (const p of params) {
						if (p.value == null) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`;
						let desc = '';
						if (p.seriesName === 'ACWR') {
							const v = p.value as number;
							const zone = v < 0.8 ? 'low' : v <= 1.3 ? 'optimal' : v <= 1.5 ? 'high' : 'very high';
							desc = ` <span style="color:#555568;font-size:10px">${zone}</span>`;
						} else if (p.seriesName === 'Acute') {
							desc = ` <span style="color:#555568;font-size:10px">7-day load</span>`;
						} else if (p.seriesName === 'Chronic') {
							desc = ` <span style="color:#555568;font-size:10px">28-day load</span>`;
						}
						html += `${dot}${p.seriesName}: <b>${p.value}</b>${desc}<br/>`;
					}
					return html;
				},
			},
			legend: {
				data: [
					{ name: 'ACWR', itemStyle: { color: '#3b82f6' } },
					{ name: 'Acute', itemStyle: { color: '#f59e0b' } },
					{ name: 'Chronic', itemStyle: { color: '#14b8a6' } },
				],
				top: 6,
				textStyle: { color: '#8888a0', fontSize: 11 },
			},
			xAxis: {
				type: 'category',
				data: days,
				axisLine: { lineStyle: { color: '#2a2a3a' } },
				axisLabel: { color: '#555568', fontSize: 10 },
			},
			yAxis: [
				{
					type: 'value', name: 'ACWR',
					nameTextStyle: { color: '#555568', fontSize: 10 },
					min: 0, max: 2,
					axisLine: { show: false },
					axisLabel: { color: '#555568', fontSize: 10 },
					splitLine: { lineStyle: { color: '#1e1e2a' } },
				},
				{
					type: 'value', name: 'Load',
					nameTextStyle: { color: '#555568', fontSize: 10 },
					axisLine: { show: false },
					axisLabel: { color: '#555568', fontSize: 10 },
					splitLine: { show: false },
				},
			],
			series: [
				{
					type: 'line', yAxisIndex: 0, data: acwrValues, name: 'ACWR',
					smooth: true, symbol: 'none',
					lineStyle: { width: 2.5, color: '#3b82f6' },
					itemStyle: { color: '#3b82f6' },
					markLine: {
						silent: true,
						symbol: 'none',
						label: {
							position: 'insideEndTop',
							fontSize: 9,
							color: '#555568',
						},
						data: [
							{ yAxis: 0.8, lineStyle: { color: '#22c55e', width: 2, type: 'dashed' }, label: { formatter: '0.8' } },
							{ yAxis: 1.3, lineStyle: { color: '#22c55e', width: 2, type: 'dashed' }, label: { formatter: '1.3' } },
							{ yAxis: 1.5, lineStyle: { color: '#ef4444', width: 1.5, type: 'dashed' }, label: { formatter: '1.5' } },
						],
					},
				},
				{
					type: 'line', yAxisIndex: 1, data: acuteValues, name: 'Acute',
					smooth: true, symbol: 'none',
					lineStyle: { width: 1.5, type: 'dashed', color: '#f59e0b' },
					itemStyle: { color: '#f59e0b' },
				},
				{
					type: 'line', yAxisIndex: 1, data: chronicValues, name: 'Chronic',
					smooth: true, symbol: 'none',
					lineStyle: { width: 1.5, color: '#14b8a6' },
					itemStyle: { color: '#14b8a6' },
				},
			],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text={"White line = ACWR (acute ÷ chronic)\n\nDashed green lines = optimal zone (0.8–1.3)\nDashed red line = overreaching threshold (1.5)\n\nDashed amber = 7-day acute load\nSolid blue = 28-day chronic load"}>
		<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">ACWR Trend</h2>
	</Tip>
	<div bind:this={chartEl} class="h-[260px] w-full"></div>
</div>
