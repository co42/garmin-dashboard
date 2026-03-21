<script lang="ts">
	import { FITNESS_TREND_LABEL } from '$lib/colors.js';

	interface Props {
		label: string;
		value: string;
		subtitle: string;
		trend?: number;
		delta?: number;
	}

	let { label, value, subtitle, trend, delta }: Props = $props();

	const trendInfo = $derived(trend != null ? FITNESS_TREND_LABEL[trend] : null);
	const deltaColor = $derived(
		delta != null
			? delta < 0 ? '#22c55e' : delta > 0 ? '#ef4444' : '#8888a0'
			: null
	);
	const deltaText = $derived(
		delta != null
			? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} yrs`
			: null
	);
</script>

<div class="rounded-lg bg-card p-4">
	<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">{label}</span>
	<div class="mt-1 flex items-baseline gap-2">
		<span class="text-3xl font-bold text-text">{value}</span>
		{#if trendInfo}
			<span class="text-lg" style="color: {trendInfo.color}">{trendInfo.arrow}</span>
		{/if}
		{#if deltaText}
			<span class="text-sm font-medium" style="color: {deltaColor}">{deltaText}</span>
		{/if}
	</div>
	<span class="text-xs text-text-secondary">{subtitle}</span>
</div>
