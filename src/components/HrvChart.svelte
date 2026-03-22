<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { HrvDay } from '$lib/types.js';
	import { hrvStatusColor } from '$lib/colors.js';
	import Tip from './Tip.svelte';

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
			grid: { top: 20, right: 16, bottom: 30, left: 40 },
			tooltip: {
				trigger: 'axis',
				confine: true,
				backgroundColor: '#1e1e2a', borderColor: '#2a2a3a',
				textStyle: { color: '#e8e8ed', fontSize: 12 },
				formatter(params: any) {
					const idx = params[0]?.dataIndex ?? 0;
					return `${dates[idx]}<br/>Weekly avg: <b>${values[idx]}</b> ms<br/>Baseline: ${corridorLow[idx]}–${corridorHigh[idx]}<br/>Status: ${statuses[idx]}`;
				},
			},
			xAxis: {
				type: 'category', data: dates,
				axisLine: { lineStyle: { color: '#2a2a3a' } },
				axisLabel: { color: '#555568', fontSize: 10, interval: 6 },
			},
			yAxis: {
				type: 'value',
				axisLine: { show: false },
				axisLabel: { color: '#555568', fontSize: 10 },
				splitLine: { lineStyle: { color: '#1e1e2a' } },
			},
			series: [
				// Baseline corridor upper (dashed, same style as ACWR zone lines)
				{
					type: 'line', data: corridorHigh, smooth: true, symbol: 'none',
					lineStyle: { width: 2, type: 'dashed', color: '#22c55e' },
					z: 1,
				},
				// Baseline corridor lower (dashed)
				{
					type: 'line', data: corridorLow, smooth: true, symbol: 'none',
					lineStyle: { width: 2, type: 'dashed', color: '#22c55e' },
					z: 1,
				},
				// Weekly avg line (same as ACWR main line)
				{
					type: 'line', data: values, smooth: true, symbol: 'none',
					lineStyle: { width: 2.5, color: '#3b82f6' },
					itemStyle: { color: '#3b82f6' },
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
		<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">HRV Trend</h2>
	</Tip>
	<div bind:this={chartEl} class="h-[260px] w-full"></div>
</div>
