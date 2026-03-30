<script lang="ts">
	import type { DailyTrainingStatus } from '$lib/types.js';
	import { C, LOAD_COLORS } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Scales from 'phosphor-svelte/lib/Scales';

	interface Props {
		status: DailyTrainingStatus;
		statusHistory: DailyTrainingStatus[];
	}

	let { status, statusHistory }: Props = $props();

	const barTips: Record<string, string> = {
		'Aero High': 'Load from tempo runs, threshold efforts, and hard aerobic sessions. Builds speed endurance and lactate clearance.',
		'Aero Low': 'Load from easy runs, Z2 efforts, and recovery jogs. Builds your aerobic base — the foundation for everything else.',
		'Anaerobic': 'Load from intervals, sprints, and VO2max sessions. Builds top-end speed and neuromuscular power.',
	};

	// Find status from last Sunday (day before this Monday) for "since Monday" delta
	const prevStatus = $derived(() => {
		const now = new Date();
		const day = now.getUTCDay();
		const monday = new Date(now);
		monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
		// We want the status from the day before Monday (= last Sunday)
		const sunday = new Date(monday);
		sunday.setUTCDate(monday.getUTCDate() - 1);
		const sundayStr = sunday.toISOString().slice(0, 10);
		let best: DailyTrainingStatus | null = null;
		for (const s of statusHistory) {
			if (s.date <= sundayStr) best = s;
		}
		return best;
	});

	const bars = $derived(() => {
		const prev = prevStatus();
		return [
			{
				label: 'Aero Low',
				value: status.monthly_load_aerobic_low,
				prevValue: prev?.monthly_load_aerobic_low ?? status.monthly_load_aerobic_low,
				min: status.monthly_load_aerobic_low_target_min,
				max: status.monthly_load_aerobic_low_target_max,
				color: LOAD_COLORS.aeroLow,
			},
			{
				label: 'Aero High',
				value: status.monthly_load_aerobic_high,
				prevValue: prev?.monthly_load_aerobic_high ?? status.monthly_load_aerobic_high,
				min: status.monthly_load_aerobic_high_target_min,
				max: status.monthly_load_aerobic_high_target_max,
				color: LOAD_COLORS.aeroHigh,
			},
			{
				label: 'Anaerobic',
				value: status.monthly_load_anaerobic,
				prevValue: prev?.monthly_load_anaerobic ?? status.monthly_load_anaerobic,
				min: status.monthly_load_anaerobic_target_min,
				max: status.monthly_load_anaerobic_target_max,
				color: LOAD_COLORS.anaerobic,
			},
		];
	});

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
	<Tip text={"Your 4-week training load broken into three types.\nEach has a personalized target range.\nDashed = load added since Monday.\n\nAll three in range = balanced training.\nShortages or surpluses indicate imbalanced training."}>
		<h2 class="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Scales size={14} weight="bold" /> Load Balance</h2>
	</Tip>

	<div class="space-y-5">
		{#each bars() as bar}
			{@const max = scaleMax(bars())}
			{@const zoneLeft = (bar.min / max) * 100}
			{@const zoneWidth = ((bar.max - bar.min) / max) * 100}
			{@const valueWidth = Math.min((bar.value / max) * 100, 100)}
			{@const prevWidth = Math.min((bar.prevValue / max) * 100, 100)}
			{@const weekDelta = Math.round(bar.value - bar.prevValue)}
			<div>
				<div class="mb-1.5 flex items-baseline justify-between">
					<span class="flex items-baseline gap-1.5">
						<Tip text={barTips[bar.label]}>
							<span class="text-xs font-medium text-text-secondary">{bar.label}</span>
						</Tip>
						{#if weekDelta !== 0}
							<span class="num text-[10px] text-text-dim">({weekDelta > 0 ? '+' : ''}{weekDelta} this wk)</span>
						{/if}
					</span>
					<span class="num text-xs font-medium" style="color: {deltaColor(bar.value, bar.min, bar.max)}">
						{delta(bar.value, bar.min, bar.max)}
					</span>
				</div>
				<Tip text="{Math.round(bar.value)} / target {bar.min}–{bar.max}{weekDelta !== 0 ? '\n' + (weekDelta > 0 ? '+' : '') + weekDelta + ' since Monday' : ''}">
				<div class="relative h-5 rounded bg-card-border">
					<!-- Solid: load from before this week -->
					{#if prevWidth > 0}
						<div class="absolute left-0 top-0 h-full transition-all" style="width: {Math.min(prevWidth, valueWidth)}%; background: {bar.color}; opacity: 0.7; border-radius: {valueWidth <= prevWidth ? '4px' : '4px 0 0 4px'};"></div>
					{/if}
					<!-- Striped: load added this week -->
					{#if valueWidth > prevWidth}
						<div class="absolute top-0 h-full transition-all" style="left: {prevWidth}%; width: {valueWidth - prevWidth}%; background: {bar.color}; opacity: 0.4; border-radius: {prevWidth <= 0 ? '4px' : '0 4px 4px 0'};"></div>
						<div class="absolute top-0 h-full transition-all" style="left: {prevWidth}%; width: {valueWidth - prevWidth}%; background: repeating-linear-gradient(110deg, transparent 0px, transparent 3px, {bar.color}40 3px, {bar.color}40 5px); border-radius: {prevWidth <= 0 ? '4px' : '0 4px 4px 0'};"></div>
					{/if}
					<!-- Target zone -->
					<div class="absolute top-0 z-10 h-full rounded-sm border-2 border-white/50" style="left: {zoneLeft}%; width: {zoneWidth}%;"></div>
				</div>
				</Tip>
			</div>
		{/each}
	</div>
</div>
