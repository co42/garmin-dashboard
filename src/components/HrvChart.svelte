<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { HrvDay } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, hrvStatusColor } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Heartbeat from 'phosphor-svelte/lib/Heartbeat';

	interface Props {
		hrv: HrvDay[];
	}

	let { hrv }: Props = $props();
	let chartEl: HTMLDivElement;

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		const dates = hrv.map(d => d.date.slice(5, 10));
		const values = hrv.map(d => d.weekly_average);
		const statuses = hrv.map(d => d.status);

		// Compute rolling baseline corridor
		const baseline = values.map((_, i) => {
			const window = values.slice(Math.max(0, i - 6), i + 1);
			return window.reduce((s, v) => s + v, 0) / window.length;
		});
		const corridorLow = baseline.map(v => Math.round(v - 5));
		const corridorHigh = baseline.map(v => Math.round(v + 5));

		const scatterData = hrv.map((d, i) => ({
			value: [i, d.weekly_average],
			itemStyle: { color: hrvStatusColor(d.status) },
		}));

		_chart.setOption({
			grid: { top: 35, right: 16, bottom: 30, left: 40 },
			legend: {
				data: [
					{ name: 'Weekly avg', itemStyle: { color: C.blue } },
					{ name: 'Baseline', itemStyle: { color: C.green }, lineStyle: { type: 'dashed' } },
				],
				top: 4,
				textStyle: { color: C.textSecondary, fontSize: 10 },
			},
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				formatter(params: any) {
					const idx = params[0]?.dataIndex ?? 0;
					return `${dates[idx]}<br/>Weekly avg: <b>${values[idx]}</b> ms<br/>Baseline: ${corridorLow[idx]}–${corridorHigh[idx]}<br/>Status: ${statuses[idx]}`;
				},
			},
			xAxis: {
				type: 'category', data: dates,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, interval: 6 },
			},
			yAxis: {
				type: 'value',
				min: (v: { min: number }) => Math.floor(v.min - 3),
				axisLine: { show: false },
				axisLabel: CHART_AXIS.axisLabel,
				splitLine: CHART_AXIS.splitLine,
			},
			series: [
				// Baseline corridor upper
				{
					type: 'line', name: 'Baseline', data: corridorHigh, smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					z: 1,
				},
				// Baseline corridor lower (same name = linked toggle in legend)
				{
					type: 'line', name: 'Baseline', data: corridorLow, smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					z: 1,
				},
				// Weekly avg line
				{
					type: 'line', name: 'Weekly avg', data: values, smooth: true, symbol: 'none',
					lineStyle: { width: 2.5, color: C.blue },
					itemStyle: { color: C.blue },
					z: 3,
				},
			],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text={"Heart Rate Variability — variation between heartbeats.\nHigher = more recovered nervous system.\n\nDots:\n• Green = balanced (within baseline)\n• Amber = unbalanced\n• Red = low\n\nDashed green lines = your personal baseline corridor."}>
		<h2 class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Heartbeat size={14} weight="bold" /> HRV Trend</h2>
	</Tip>
	<div bind:this={chartEl} class="h-[260px] w-full"></div>
</div>
