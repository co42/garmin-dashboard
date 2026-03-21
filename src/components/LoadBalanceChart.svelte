<script lang="ts">
	import type { LoadBalance } from '$lib/types.js';
	import { LOAD_COLORS } from '$lib/colors.js';

	interface Props {
		loadBalance: LoadBalance;
	}

	let { loadBalance }: Props = $props();

	const bars = $derived([
		{
			label: 'Aero High',
			value: loadBalance.monthlyLoadAerobicHigh,
			min: loadBalance.monthlyLoadAerobicHighTargetMin,
			max: loadBalance.monthlyLoadAerobicHighTargetMax,
			color: LOAD_COLORS.aeroHigh,
		},
		{
			label: 'Aero Low',
			value: loadBalance.monthlyLoadAerobicLow,
			min: loadBalance.monthlyLoadAerobicLowTargetMin,
			max: loadBalance.monthlyLoadAerobicLowTargetMax,
			color: LOAD_COLORS.aeroLow,
		},
		{
			label: 'Anaerobic',
			value: loadBalance.monthlyLoadAnaerobic,
			min: loadBalance.monthlyLoadAnaerobicTargetMin,
			max: loadBalance.monthlyLoadAnaerobicTargetMax,
			color: LOAD_COLORS.anaerobic,
		},
	]);

	function delta(value: number, min: number, max: number): string {
		if (value > max) return `+${Math.round(value - max)} over`;
		if (value < min) return `${Math.round(value - min)} below`;
		return 'in range';
	}

	function deltaColor(value: number, min: number, max: number): string {
		if (value > max) return '#f59e0b';
		if (value < min) return '#ef4444';
		return '#22c55e';
	}

	function scaleMax(bars: typeof bars.$type): number {
		let m = 0;
		for (const b of bars) {
			m = Math.max(m, b.value, b.max);
		}
		return m * 1.15;
	}
</script>

<div class="rounded-lg bg-card p-4">
	<h2 class="mb-4 text-xs font-medium uppercase tracking-wider text-text-secondary">Load Balance</h2>

	<div class="space-y-5">
		{#each bars as bar}
			{@const max = scaleMax(bars)}
			{@const zoneLeft = (bar.min / max) * 100}
			{@const zoneWidth = ((bar.max - bar.min) / max) * 100}
			{@const valueWidth = Math.min((bar.value / max) * 100, 100)}
			<div>
				<div class="mb-1.5 flex items-baseline justify-between">
					<span class="text-xs font-medium text-text-secondary">{bar.label}</span>
					<span class="text-xs font-medium" style="color: {deltaColor(bar.value, bar.min, bar.max)}">
						{Math.round(bar.value)} · {delta(bar.value, bar.min, bar.max)}
					</span>
				</div>
				<div class="relative h-5 rounded bg-card-border">
					<!-- Target zone band -->
					<div
						class="absolute top-0 h-full rounded opacity-25"
						style="left: {zoneLeft}%; width: {zoneWidth}%; background: {bar.color};"
					></div>
					<!-- Target zone border -->
					<div
						class="absolute top-0 h-full rounded border opacity-50"
						style="left: {zoneLeft}%; width: {zoneWidth}%; border-color: {bar.color};"
					></div>
					<!-- Current value bar -->
					<div
						class="absolute left-0 top-0 h-full rounded transition-all"
						style="width: {valueWidth}%; background: {bar.color}; opacity: 0.8;"
					></div>
				</div>
				<div class="mt-1 flex justify-between text-[10px] text-text-dim">
					<span>{bar.min}</span>
					<span>{bar.max}</span>
				</div>
			</div>
		{/each}
	</div>
</div>
