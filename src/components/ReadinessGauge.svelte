<script lang="ts">
	import { onMount } from 'svelte';
	import type { Readiness } from '$lib/types.js';
	import { READINESS_COLOR } from '$lib/colors.js';

	interface Props {
		readiness: Readiness;
	}

	let { readiness }: Props = $props();

	let chartEl: HTMLDivElement;

	const factors = $derived([
		{ label: 'HRV', value: readiness.hrvFactorPercent, feedback: readiness.hrvFactorFeedback },
		{ label: 'Sleep', value: readiness.sleepHistoryFactorPercent, feedback: readiness.sleepHistoryFactorFeedback },
		{ label: 'Recovery', value: readiness.recoveryTimeFactorPercent, feedback: readiness.recoveryTimeFactorFeedback },
		{ label: 'Stress', value: readiness.stressHistoryFactorPercent, feedback: readiness.stressHistoryFactorFeedback },
		{ label: 'ACWR', value: readiness.acwrFactorPercent, feedback: readiness.acwrFactorFeedback },
	]);

	const color = $derived(READINESS_COLOR(readiness.score));

	onMount(async () => {
		const echarts = await import('echarts');
		const chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		chart.setOption({
			series: [{
				type: 'gauge',
				startAngle: 225,
				endAngle: -45,
				min: 0,
				max: 100,
				radius: '90%',
				progress: {
					show: true,
					width: 14,
					roundCap: true,
					itemStyle: { color },
				},
				pointer: { show: false },
				axisLine: {
					lineStyle: { width: 14, color: [[1, '#1e1e2a']] },
					roundCap: true,
				},
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: { show: false },
				title: { show: false },
				detail: {
					valueAnimation: true,
					fontSize: 32,
					fontWeight: 'bold',
					color: '#e8e8ed',
					offsetCenter: [0, 0],
				},
				data: [{ value: readiness.score }],
			}],
		});

		const ro = new ResizeObserver(() => chart.resize());
		ro.observe(chartEl);
		return () => { ro.disconnect(); chart.dispose(); };
	});

	function barColor(value: number): string {
		if (value >= 80) return '#22c55e';
		if (value >= 40) return '#f59e0b';
		return '#ef4444';
	}
</script>

<div class="rounded-lg bg-card p-4">
	<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">Readiness</h2>
	<div bind:this={chartEl} class="mx-auto h-[160px] w-[200px]"></div>
	<div class="mt-1 text-center text-sm text-text-secondary">{readiness.level}</div>

	<div class="mt-4 space-y-2">
		{#each factors as factor}
			<div class="flex items-center gap-2">
				<span class="w-16 text-right text-xs text-text-secondary">{factor.label}</span>
				<div class="relative h-2 flex-1 rounded-full bg-card-border">
					<div
						class="absolute left-0 top-0 h-full rounded-full transition-all"
						style="width: {factor.value}%; background: {barColor(factor.value)};"
					></div>
				</div>
				<span class="w-8 text-right text-xs font-medium text-text">{factor.value}</span>
			</div>
		{/each}
	</div>
</div>
