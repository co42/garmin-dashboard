<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Readiness } from '$lib/types.js';
	import { C, readinessColor, readinessLabel } from '$lib/colors.js';
	import { resolveReadiness } from '$lib/readiness.js';
	import Gauge from 'phosphor-svelte/lib/Gauge';
	import Tip from './Tip.svelte';

	interface Props {
		readiness: Readiness;
	}

	let { readiness }: Props = $props();

	const latest = $derived(readiness.latest ?? readiness.post_activity ?? readiness.morning);
	const entry = $derived(latest ?? resolveReadiness(readiness));
	const hasBoth = $derived(!!readiness.morning && !!readiness.post_activity);

	let chartEl: HTMLDivElement;

	const factorTips: Record<string, string> = {
		HRV: 'Heart rate variability vs your personal baseline. Higher HRV = more recovered autonomic nervous system.',
		Sleep: 'Sleep quality trend over the last 3 nights. Consistently poor sleep impairs adaptation to training.',
		Recovery: 'Time since your last hard effort. Shows whether your body has had enough time to rebuild.',
		Stress: 'All-day stress levels from HRV monitoring. Chronic high stress competes with training adaptation.',
		ACWR: 'Whether your recent training load is in balance with your long-term load. Optimal ACWR supports readiness.',
	};

	const factors = $derived([
		{ label: 'HRV', value: entry.hrv_score },
		{ label: 'Sleep', value: entry.sleep_history_score },
		{ label: 'Recovery', value: entry.recovery_score },
		{ label: 'Stress', value: entry.stress_score },
		{ label: 'ACWR', value: entry.acwr_score },
	]);

	const color = $derived(readinessColor(entry.score));

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
				axisLine: { lineStyle: { width: 12, color: [[1, C.cardBorder]] }, roundCap: true },
				axisTick: { show: false },
				splitLine: { show: false },
				axisLabel: { show: false },
				title: { show: false },
				detail: {
					valueAnimation: true, fontSize: 28, fontWeight: 'bold',
					fontFamily: "'Geist Mono Variable', ui-monospace, SFMono-Regular, monospace",
					color: C.text, offsetCenter: [0, 0],
					formatter: (v: number) => `${v}%`,
				},
				data: [{ value: entry.score }],
			}],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});

	function barColor(value: number): string {
		return readinessColor(value);
	}
</script>

<div class="rounded-lg bg-card p-3 md:p-4">
	<Tip text={"How ready is your body to train today?\n\n95–100% = Prime\n75–94% = High\n50–74% = Moderate\n25–49% = Low\n0–24% = Poor\n\nComputed from HRV, sleep, recovery time, stress, and ACWR."}>
		<h2 class="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Gauge size={14} weight="bold" /> Readiness</h2>
	</Tip>

	<div class="flex items-center gap-3 md:gap-6">
		<!-- Gauge -->
		<div class="shrink-0">
			<div bind:this={chartEl} class="h-[100px] w-[110px] md:h-[120px] md:w-[140px]"></div>
			<div class="-mt-1 text-center text-xs text-text-secondary">
				{readinessLabel(entry.score)}
				{#if hasBoth && readiness.morning}
					<span class="text-text-dim">· morning {readiness.morning.score}%</span>
				{/if}
			</div>
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
					<span class="num text-right text-[11px] font-medium text-text">{factor.value}%</span>
				</div>
			{/each}
		</div>
	</div>
</div>
