<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { C, fitnessTrend, arrMin, arrMax } from '$lib/colors.js';
	import Tip from './Tip.svelte';

	interface Props {
		label: string;
		value: string;
		subtitle: string;
		tip?: string;
		trend?: string;
		delta?: number;
		sparkline?: number[];
		sparklineColor?: string;
	}

	let { label, value, subtitle, tip, trend, delta, sparkline, sparklineColor = C.textSecondary }: Props = $props();

	let sparkEl = $state<HTMLDivElement>();

	const trendInfo = $derived(trend != null ? fitnessTrend(trend) : null);
	const deltaColor = $derived(
		delta != null ? (delta < 0 ? C.green : delta > 0 ? C.red : C.textSecondary) : null
	);
	const deltaText = $derived(
		delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} yrs` : null
	);

	let _chart: any;
	let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		if (!sparkline || sparkline.length < 2 || !sparkEl) return;
		const echarts = await import('echarts');
		_chart = echarts.init(sparkEl, undefined, { renderer: 'svg' });

		_chart.setOption({
			grid: { top: 2, right: 0, bottom: 2, left: 0 },
			xAxis: { type: 'category', show: false, data: sparkline.map((_, i) => i) },
			yAxis: { type: 'value', show: false, min: arrMin(sparkline) * 0.95, max: arrMax(sparkline) * 1.05 },
			series: [{
				type: 'line', data: sparkline, symbol: 'none',
				lineStyle: { width: 1.5, color: sparklineColor },
				areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
					{ offset: 0, color: sparklineColor + '30' },
					{ offset: 1, color: sparklineColor + '05' },
				]}},
			}],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(sparkEl);
	});
</script>

<div class="rounded-lg bg-card p-4">
	{#if tip}
		<Tip text={tip}>
			<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">{label}</span>
		</Tip>
	{:else}
		<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">{label}</span>
	{/if}
	<div class="mt-1 flex items-baseline gap-2">
		<span class="num text-3xl font-bold text-text">{value}</span>
		{#if trendInfo}
			<span class="text-lg" style="color: {trendInfo.color}">{trendInfo.arrow}</span>
		{/if}
		{#if deltaText}
			<span class="num text-sm font-medium" style="color: {deltaColor}">{deltaText}</span>
		{/if}
	</div>
	<span class="num text-xs text-text-secondary">{subtitle}</span>
	{#if sparkline && sparkline.length > 1}
		<div bind:this={sparkEl} class="mt-2 h-[40px] w-full"></div>
	{/if}
</div>
