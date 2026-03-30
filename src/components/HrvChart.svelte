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
		const values = hrv.map(d => d.last_night_avg ?? d.weekly_average);
		const statuses = hrv.map(d => d.status);

		// Use API baseline range when available, otherwise compute rolling corridor
		const corridorLow = hrv.map((d, i) => {
			if (d.baseline_balanced_low != null) return d.baseline_balanced_low;
			const window = values.slice(Math.max(0, i - 6), i + 1);
			return Math.round(window.reduce((s, v) => s + v, 0) / window.length - 5);
		});
		const corridorHigh = hrv.map((d, i) => {
			if (d.baseline_balanced_upper != null) return d.baseline_balanced_upper;
			const window = values.slice(Math.max(0, i - 6), i + 1);
			return Math.round(window.reduce((s, v) => s + v, 0) / window.length + 5);
		});

		const scatterData = hrv.map((d, i) => ({
			value: [i, d.weekly_average],
			itemStyle: { color: hrvStatusColor(d.status) },
		}));

		_chart.setOption({
			grid: { top: 35, right: 16, bottom: 30, left: 40 },
			legend: {
				data: [
					{ name: 'Last night', itemStyle: { color: C.blue } },
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
					const d = hrv[idx];
					let html = `${dates[idx]}<br/>Last night: <b>${values[idx]}</b> ms`;
					if (d?.last_night_5min_high != null) html += `<br/>5-min high: ${d.last_night_5min_high} ms`;
					html += `<br/>Baseline: ${corridorLow[idx]}–${corridorHigh[idx]}`;
					html += `<br/>Weekly avg: ${d?.weekly_average ?? '-'} ms`;
					html += `<br/>Status: ${statuses[idx]}`;
					return html;
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
				// Last night avg line
				{
					type: 'line', name: 'Last night', data: values, smooth: true, symbol: 'none',
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
