<script lang="ts">
	import type { DailyTrainingStatus, Activity } from '$lib/types.js';
	import { C, LOAD_COLORS } from '$lib/colors.js';
	import { deconvolveDailyLoad, segmentLoad, type LoadSegments } from '$lib/load-deconv.js';
	import Tip from './Tip.svelte';
	import Scales from 'phosphor-svelte/lib/Scales';

	interface Props {
		status: DailyTrainingStatus;
		statusHistory: DailyTrainingStatus[];
		activities: Activity[];
	}

	let { status, statusHistory, activities }: Props = $props();

	const barTips: Record<string, string> = {
		'Aero High': 'Load from tempo runs, threshold efforts, and hard aerobic sessions. Builds speed endurance and lactate clearance.',
		'Aero Low': 'Load from easy runs, Z2 efforts, and recovery jogs. Builds your aerobic base — the foundation for everything else.',
		'Anaerobic': 'Load from intervals, sprints, and VO2max sessions. Builds top-end speed and neuromuscular power.',
	};

	// Build activity days map once
	const activityDays = $derived(() => {
		const m = new Map<string, number>();
		for (const a of activities) {
			const d = a.start_time.slice(0, 10);
			m.set(d, (m.get(d) ?? 0) + (a.activity_training_load ?? 0));
		}
		return m;
	});

	// Deconvolve each channel
	const contribsLow = $derived(deconvolveDailyLoad(statusHistory, s => s.monthly_load_aerobic_low, activityDays()));
	const contribsHigh = $derived(deconvolveDailyLoad(statusHistory, s => s.monthly_load_aerobic_high, activityDays()));
	const contribsAnaerobic = $derived(deconvolveDailyLoad(statusHistory, s => s.monthly_load_anaerobic, activityDays()));

	const targetDate = $derived(status.date.slice(0, 10));

	const bars = $derived(() => {
		const segLow = segmentLoad(contribsLow, targetDate, status.monthly_load_aerobic_low);
		const segHigh = segmentLoad(contribsHigh, targetDate, status.monthly_load_aerobic_high);
		const segAnaerobic = segmentLoad(contribsAnaerobic, targetDate, status.monthly_load_anaerobic);
		return [
			{
				label: 'Aero Low',
				value: status.monthly_load_aerobic_low,
				segments: segLow,
				min: status.monthly_load_aerobic_low_target_min,
				max: status.monthly_load_aerobic_low_target_max,
				color: LOAD_COLORS.aeroLow,
			},
			{
				label: 'Aero High',
				value: status.monthly_load_aerobic_high,
				segments: segHigh,
				min: status.monthly_load_aerobic_high_target_min,
				max: status.monthly_load_aerobic_high_target_max,
				color: LOAD_COLORS.aeroHigh,
			},
			{
				label: 'Anaerobic',
				value: status.monthly_load_anaerobic,
				segments: segAnaerobic,
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
	<Tip text={"Your 4-week training load broken into three types.\nEach has a personalized target range.\n\nBright = last 7 days · Medium = middle 14 days · Faded = expiring in 7 days\n\nAll three in range = balanced training."}>
		<h2 class="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Scales size={14} weight="bold" /> Load Balance</h2>
	</Tip>

	<div class="space-y-5">
		{#each bars() as bar}
			{@const max = scaleMax(bars())}
			{@const zoneLeft = (bar.min / max) * 100}
			{@const zoneWidth = ((bar.max - bar.min) / max) * 100}
			{@const seg = bar.segments}
			{@const expiringW = Math.min((seg.expiring / max) * 100, 100)}
			{@const middleW = Math.min((seg.middle / max) * 100, 100)}
			{@const recentW = Math.min((seg.recent / max) * 100, 100)}
			<div>
				<div class="mb-1.5 flex items-baseline justify-between">
					<span class="flex items-baseline gap-1.5">
						<Tip text={barTips[bar.label]}>
							<span class="text-xs font-medium text-text-secondary">{bar.label}</span>
						</Tip>
					</span>
					<span class="num text-xs font-medium" style="color: {deltaColor(bar.value, bar.min, bar.max)}">
						{delta(bar.value, bar.min, bar.max)}
					</span>
				</div>
				<Tip text={`${Math.round(bar.value)} / target ${bar.min}–${bar.max}\nExpiring 7d: ${String(Math.round(seg.expiring)).padStart(4)}\nMiddle 14d:  ${String(Math.round(seg.middle)).padStart(4)}\nRecent 7d:   ${String(Math.round(seg.recent)).padStart(4)}`} mono>
				<div class="relative h-5 rounded bg-card-border">
					<!-- Expiring: oldest 7 days (faded) -->
					{#if expiringW > 0}
						<div class="absolute left-0 top-0 h-full transition-all" style="width: {expiringW}%; background: {bar.color}; opacity: 0.25; border-radius: {middleW + recentW <= 0 ? '4px' : '4px 0 0 4px'};"></div>
					{/if}
					<!-- Middle: 14 days (medium) -->
					{#if middleW > 0}
						<div class="absolute top-0 h-full transition-all" style="left: {expiringW}%; width: {middleW}%; background: {bar.color}; opacity: 0.55; {expiringW <= 0 && recentW <= 0 ? 'border-radius: 4px;' : expiringW <= 0 ? 'border-radius: 4px 0 0 4px;' : recentW <= 0 ? 'border-radius: 0 4px 4px 0;' : ''}"></div>
					{/if}
					<!-- Recent: last 7 days (bright) -->
					{#if recentW > 0}
						<div class="absolute top-0 h-full transition-all" style="left: {expiringW + middleW}%; width: {recentW}%; background: {bar.color}; opacity: 0.9; border-radius: {expiringW + middleW <= 0 ? '4px' : '0 4px 4px 0'};"></div>
					{/if}
					<!-- Target zone -->
					<div class="absolute top-0 z-10 h-full rounded-sm border-2 border-white/50" style="left: {zoneLeft}%; width: {zoneWidth}%;"></div>
				</div>
				</Tip>
			</div>
		{/each}
	</div>
</div>
