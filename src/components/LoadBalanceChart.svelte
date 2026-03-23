<script lang="ts">
	import type { DailyTrainingStatus } from '$lib/types.js';
	import { C, LOAD_COLORS } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Scales from 'phosphor-svelte/lib/Scales';

	interface Props {
		status: DailyTrainingStatus;
	}

	let { status }: Props = $props();

	const barTips: Record<string, string> = {
		'Aero High': 'Load from tempo runs, threshold efforts, and hard aerobic sessions. Builds speed endurance and lactate clearance.',
		'Aero Low': 'Load from easy runs, Z2 efforts, and recovery jogs. Builds your aerobic base — the foundation for everything else.',
		'Anaerobic': 'Load from intervals, sprints, and VO2max sessions. Builds top-end speed and neuromuscular power.',
	};

	const bars = $derived([
		{
			label: 'Aero Low',
			value: status.monthly_load_aerobic_low,
			min: status.monthly_load_aerobic_low_target_min,
			max: status.monthly_load_aerobic_low_target_max,
			color: LOAD_COLORS.aeroLow,
		},
		{
			label: 'Aero High',
			value: status.monthly_load_aerobic_high,
			min: status.monthly_load_aerobic_high_target_min,
			max: status.monthly_load_aerobic_high_target_max,
			color: LOAD_COLORS.aeroHigh,
		},
		{
			label: 'Anaerobic',
			value: status.monthly_load_anaerobic,
			min: status.monthly_load_anaerobic_target_min,
			max: status.monthly_load_anaerobic_target_max,
			color: LOAD_COLORS.anaerobic,
		},
	]);

	function delta(value: number, min: number, max: number): string {
		if (value > max) return `+${Math.round(value - max)} over`;
		if (value < min) return `${Math.round(value - min)} below`;
		return 'in range';
	}

	function deltaColor(value: number, min: number, max: number): string {
		if (value > max) return C.amber;
		if (value < min) return C.red;
		return C.green;
	}

	function scaleMax(items: { value: number; max: number }[]): number {
		let m = 0;
		for (const b of items) m = Math.max(m, b.value, b.max);
		return m * 1.15;
	}
</script>

<div class="rounded-lg bg-card p-4 h-full">
	<Tip text={"Your 4-week training load broken into three types.\nEach has a personalized target range.\n\nAll three in range = balanced training.\nShortages or surpluses indicate imbalanced training."}>
		<h2 class="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Scales size={14} weight="bold" /> Load Balance</h2>
	</Tip>

	<div class="space-y-5">
		{#each bars as bar}
			{@const max = scaleMax(bars)}
			{@const zoneLeft = (bar.min / max) * 100}
			{@const zoneWidth = ((bar.max - bar.min) / max) * 100}
			{@const valueWidth = Math.min((bar.value / max) * 100, 100)}
			<div>
				<div class="mb-1.5 flex items-baseline justify-between">
					<Tip text={barTips[bar.label]}>
						<span class="text-xs font-medium text-text-secondary">{bar.label}</span>
					</Tip>
					<Tip text="Target: {bar.min}–{bar.max}. Garmin computes this from your training history. In range = balanced.">
						<span class="num text-xs font-medium" style="color: {deltaColor(bar.value, bar.min, bar.max)}">
							{Math.round(bar.value)} <span class="text-text-dim">/ {bar.min}–{bar.max}</span> · {delta(bar.value, bar.min, bar.max)}
						</span>
					</Tip>
				</div>
				<div class="relative h-5 rounded bg-card-border" title="Target: {bar.min}–{bar.max} · Current: {Math.round(bar.value)}">
					<div class="absolute top-0 h-full rounded" style="left: {zoneLeft}%; width: {zoneWidth}%; background: repeating-linear-gradient(120deg, {bar.color}15 0px, {bar.color}15 3px, transparent 3px, transparent 7px);"></div>
					<div class="absolute left-0 top-0 h-full rounded transition-all" style="width: {valueWidth}%; background: {bar.color}; opacity: 0.7;"></div>
					<div class="absolute top-0 z-10 h-full" style="left: {zoneLeft}%; width: 1.5px; background: {C.text}; opacity: 0.5;"></div>
					<div class="absolute top-0 z-10 h-full" style="left: {zoneLeft + zoneWidth}%; width: 1.5px; background: {C.text}; opacity: 0.5;"></div>
				</div>
			</div>
		{/each}
	</div>
</div>
