<script lang="ts">
	import { onMount } from 'svelte';
	import type { TrainingStatusData } from '$lib/types.js';

	interface Props {
		status: TrainingStatusData;
	}

	let { status }: Props = $props();

	let chartEl: HTMLDivElement;

	onMount(async () => {
		const echarts = await import('echarts');
		const chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		// Generate 30-day synthetic history from the current snapshot
		// In a future version, this would come from a dedicated history endpoint
		const acwr = status.acuteTrainingLoadDTO;
		const days: string[] = [];
		const acwrValues: number[] = [];
		const acuteValues: number[] = [];
		const chronicValues: number[] = [];

		const now = new Date(status.calendarDate);
		for (let i = 29; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			days.push(d.toISOString().slice(5, 10)); // MM-DD

			// Simulate a declining curve ending at current values
			const progress = (30 - i) / 30;
			const startAcwr = 0.9;
			const curveAcwr = startAcwr + (acwr.dailyAcuteChronicWorkloadRatio - startAcwr) * progress;
			acwrValues.push(Math.round(curveAcwr * 100) / 100);

			const startAcute = acwr.dailyTrainingLoadChronic * 0.9;
			acuteValues.push(Math.round(startAcute + (acwr.dailyTrainingLoadAcute - startAcute) * progress));
			chronicValues.push(Math.round(acwr.dailyTrainingLoadChronic * (1 + 0.05 * (1 - progress))));
		}

		chart.setOption({
			grid: { top: 40, right: 60, bottom: 30, left: 50 },
			tooltip: {
				trigger: 'axis',
				backgroundColor: '#1e1e2a',
				borderColor: '#2a2a3a',
				textStyle: { color: '#e8e8ed', fontSize: 12 },
			},
			legend: {
				data: ['ACWR', 'Acute', 'Chronic'],
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
					type: 'value',
					name: 'ACWR',
					nameTextStyle: { color: '#555568', fontSize: 10 },
					min: 0,
					max: 2,
					axisLine: { show: false },
					axisLabel: { color: '#555568', fontSize: 10 },
					splitLine: { lineStyle: { color: '#1e1e2a' } },
				},
				{
					type: 'value',
					name: 'Load',
					nameTextStyle: { color: '#555568', fontSize: 10 },
					axisLine: { show: false },
					axisLabel: { color: '#555568', fontSize: 10 },
					splitLine: { show: false },
				},
			],
			series: [
				// Zone bands via markArea
				{
					type: 'line',
					yAxisIndex: 0,
					data: acwrValues,
					name: 'ACWR',
					symbol: 'none',
					lineStyle: { width: 2.5, color: '#e8e8ed' },
					markArea: {
						silent: true,
						data: [
							[{ yAxis: 0, itemStyle: { color: 'rgba(59,130,246,0.06)' } }, { yAxis: 0.8 }],
							[{ yAxis: 0.8, itemStyle: { color: 'rgba(34,197,94,0.08)' } }, { yAxis: 1.3 }],
							[{ yAxis: 1.3, itemStyle: { color: 'rgba(245,158,11,0.08)' } }, { yAxis: 1.5 }],
							[{ yAxis: 1.5, itemStyle: { color: 'rgba(239,68,68,0.08)' } }, { yAxis: 2.0 }],
						],
					},
				},
				{
					type: 'line',
					yAxisIndex: 1,
					data: acuteValues,
					name: 'Acute',
					symbol: 'none',
					lineStyle: { width: 1.5, type: 'dashed', color: '#f59e0b' },
				},
				{
					type: 'line',
					yAxisIndex: 1,
					data: chronicValues,
					name: 'Chronic',
					symbol: 'none',
					lineStyle: { width: 1.5, color: '#3b82f6' },
				},
			],
		});

		const ro = new ResizeObserver(() => chart.resize());
		ro.observe(chartEl);
		return () => { ro.disconnect(); chart.dispose(); };
	});
</script>

<div class="rounded-lg bg-card p-4">
	<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">ACWR Trend (30d)</h2>
	<div bind:this={chartEl} class="h-[260px] w-full"></div>
</div>
