<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Readiness } from '$lib/types.js';
	import { readinessColor } from '$lib/colors.js';
	import Tip from './Tip.svelte';

	interface Props {
		readiness: Readiness;
	}

	let { readiness }: Props = $props();

	let chartEl: HTMLDivElement;

	const factorTips: Record<string, string> = {
		HRV: 'Heart rate variability vs your personal baseline. Higher HRV = more recovered autonomic nervous system.',
		Sleep: 'Sleep quality trend over the last 3 nights. Consistently poor sleep impairs adaptation to training.',
		Recovery: 'Time since your last hard effort. Shows whether your body has had enough time to rebuild.',
		Stress: 'All-day stress levels from HRV monitoring. Chronic high stress competes with training adaptation.',
		ACWR: 'Whether your recent training load is in balance with your long-term load. Optimal ACWR supports readiness.',
	};

	const factors = $derived([
		{ label: 'HRV', value: readiness.hrv_score },
		{ label: 'Sleep', value: readiness.sleep_history_score },
		{ label: 'Recovery', value: readiness.recovery_score },
		{ label: 'Stress', value: readiness.stress_score },
		{ label: 'ACWR', value: readiness.acwr_score },
	]);

	const color = $derived(readinessColor(readiness.score));

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		_chart.setOption({
			series: [{
				type: 'gauge',
				startAngle: 225,
				endAngle: -45,
				min: 0,
				max: 100,
				radius: '90%',
				progress: { show: true, width: 12, roundCap: true, itemStyle: { color } },
				pointer: { show: false },
				axisLine: { lineStyle: { width: 12, color: [[1, '#1e1e2a']] }, roundCap: true },
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: { show: false },
				title: { show: false },
				detail: {
					valueAnimation: true, fontSize: 28, fontWeight: 'bold',
					color: '#e8e8ed', offsetCenter: [0, 0],
				},
				data: [{ value: readiness.score }],
			}],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});

	function barColor(value: number): string {
		if (value >= 80) return '#22c55e';
		if (value >= 40) return '#f59e0b';
		return '#ef4444';
	}
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text={"How ready is your body to train today? (0–100)\n\n70+ = push hard\n40–69 = moderate effort\n< 40 = rest\n\nComputed from HRV, sleep, recovery time, stress, and ACWR."}>
		<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">Readiness</h2>
	</Tip>

	<div class="flex items-center gap-6">
		<!-- Gauge -->
		<div class="shrink-0">
			<div bind:this={chartEl} class="h-[120px] w-[140px]"></div>
			<div class="-mt-1 text-center text-xs text-text-secondary">{readiness.level}</div>
		</div>

		<!-- Factor bars -->
		<div class="flex-1 space-y-2.5">
			{#each factors as factor}
				<div class="grid items-center gap-2" style="grid-template-columns: 52px 1fr 24px;">
					<Tip text={factorTips[factor.label]}>
						<span class="block text-right text-[11px] text-text-secondary">{factor.label}</span>
					</Tip>
					<div class="relative h-1.5 rounded-full bg-card-border">
						<div
							class="absolute left-0 top-0 h-full rounded-full"
							style="width: {factor.value}%; background: {barColor(factor.value)};"
						></div>
					</div>
					<span class="num text-right text-[11px] font-medium text-text">{factor.value}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
