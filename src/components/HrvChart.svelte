<script lang="ts">
	import { onMount } from 'svelte';
	import type { HrvDay } from '$lib/types.js';
	import { HRV_STATUS_COLORS } from '$lib/colors.js';

	interface Props {
		hrv: HrvDay[];
	}

	let { hrv }: Props = $props();

	let chartEl: HTMLDivElement;

	onMount(async () => {
		const echarts = await import('echarts');
		const chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		// Filter to days with summary data and sort chronologically
		const days = hrv
			.filter(d => d.hrvSummary)
			.sort((a, b) => a.hrvSummary.calendarDate.localeCompare(b.hrvSummary.calendarDate));

		const dates = days.map(d => d.hrvSummary.calendarDate.slice(5)); // MM-DD
		const weeklyAvgs = days.map(d => d.hrvSummary.weeklyAvg);
		const balancedLows = days.map(d => d.hrvSummary.baseline.balancedLow);
		const balancedUppers = days.map(d => d.hrvSummary.baseline.balancedUpper);
		const statuses = days.map(d => d.hrvSummary.status);

		// Create colored scatter points
		const scatterData = days.map((d, i) => ({
			value: [i, d.hrvSummary.weeklyAvg],
			itemStyle: { color: HRV_STATUS_COLORS[d.hrvSummary.status] ?? '#8888a0' },
		}));

		chart.setOption({
			grid: { top: 20, right: 16, bottom: 30, left: 40 },
			tooltip: {
				trigger: 'axis',
				backgroundColor: '#1e1e2a',
				borderColor: '#2a2a3a',
				textStyle: { color: '#e8e8ed', fontSize: 12 },
				formatter(params: any) {
					const idx = params[0]?.dataIndex ?? 0;
					const status = statuses[idx] ?? '';
					return `${dates[idx]}<br/>Weekly avg: <b>${weeklyAvgs[idx]}</b> ms<br/>Status: ${status}`;
				},
			},
			xAxis: {
				type: 'category',
				data: dates,
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
				// Baseline corridor (filled band)
				{
					type: 'line',
					data: balancedUppers,
					symbol: 'none',
					lineStyle: { width: 0 },
					areaStyle: { color: 'rgba(34,197,94,0.08)' },
					stack: 'baseline',
					z: 1,
				},
				{
					type: 'line',
					data: balancedLows,
					symbol: 'none',
					lineStyle: { width: 0 },
					areaStyle: { color: '#13131a' },
					stack: 'baseline',
					z: 1,
				},
				// Weekly avg line
				{
					type: 'line',
					data: weeklyAvgs,
					symbol: 'none',
					lineStyle: { width: 2, color: '#e8e8ed' },
					z: 3,
				},
				// Status-colored dots
				{
					type: 'scatter',
					data: scatterData,
					symbolSize: 6,
					z: 4,
				},
			],
		});

		const ro = new ResizeObserver(() => chart.resize());
		ro.observe(chartEl);
		return () => { ro.disconnect(); chart.dispose(); };
	});
</script>

<div class="rounded-lg bg-card p-4">
	<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">HRV Trend (30d)</h2>
	<div bind:this={chartEl} class="h-[260px] w-full"></div>
</div>
