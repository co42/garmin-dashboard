<script lang="ts">
	import type { DailyTrainingStatus, Activity, HrZone } from '$lib/types.js';
	import { C, LOAD_COLORS, ZONE_COLORS } from '$lib/colors.js';
	import { deconvolveDailyLoad, segmentLoad, type LoadSegments } from '$lib/load-deconv.js';
	import Tip from './Tip.svelte';
	import Scales from 'phosphor-svelte/lib/Scales';

	interface Props {
		status: DailyTrainingStatus;
		statusHistory: DailyTrainingStatus[];
		activities: Activity[];
		hrZones: HrZone[];
		maxHr: number | null;
		lactateHr: number | null;
		lactatePace: string | null;
	}

	let { status, statusHistory, activities, hrZones, maxHr, lactateHr, lactatePace }: Props = $props();

	const ZONE_TIPS: Record<number, string> = {
		1: 'Recovery / warm-up.\nVery light effort, conversational pace.',
		2: 'Aerobic base / easy run.\nComfortable pace, can hold a conversation.',
		3: 'Tempo / threshold.\nComfortably hard, can speak in short sentences.',
		4: 'VO2max intervals.\nHard effort, only a few words at a time.',
		5: 'Anaerobic / sprint.\nAll-out effort, unsustainable for long.',
	};

	const barTips: Record<string, string> = {
		'Aero High': 'Load from tempo runs, threshold efforts, and hard aerobic sessions. Builds speed endurance and lactate clearance.',
		'Aero Low': 'Load from easy runs, Z2 efforts, and recovery jogs. Builds your aerobic base — the foundation for everything else.',
		'Anaerobic': 'Load from intervals, sprints, and VO2max sessions. Builds top-end speed and neuromuscular power.',
	};

	// Build activity days map once
	const activityDays = $derived(() => {
		const m = new Map<string, number>();
		for (const a of activities) {
			const d = a.start_time_local.slice(0, 10);
			m.set(d, (m.get(d) ?? 0) + (a.activity_training_load ?? 0));
		}
		return m;
	});

	// Deconvolve each channel
	const contribsLow = $derived(deconvolveDailyLoad(statusHistory, s => s.monthly_load_aerobic_low, activityDays()));
	const contribsHigh = $derived(deconvolveDailyLoad(statusHistory, s => s.monthly_load_aerobic_high, activityDays()));
	const contribsAnaerobic = $derived(deconvolveDailyLoad(statusHistory, s => s.monthly_load_anaerobic, activityDays()));

	const targetDate = $derived(status.date.slice(0, 10));

	interface BarItem {
		label: string;
		value: number;
		min: number;
		max: number;
		color: string;
		segments: LoadSegments;
	}

	const bars = $derived((): BarItem[] => {
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

	function scaleMax(items: BarItem[]): number {
		let m = 0;
		for (const b of items) m = Math.max(m, b.value, b.max);
		return m * 1.15;
	}

	function tooltipHtml(bar: BarItem): string {
		const seg = bar.segments!;
		return `<b>${Math.round(bar.value)}</b> <span style="color:${C.textDim}">/ target ${bar.min}\u2013${bar.max}</span><table style="border-spacing:8px 2px;margin-top:4px"><tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bar.color};opacity:0.9;margin-right:4px"></span>Recent&nbsp;</td><td style="color:${C.textDim}">7d&nbsp;</td><td style="text-align:right"><b>${Math.round(seg.recent)}</b></td></tr><tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bar.color};opacity:0.55;margin-right:4px"></span>Middle&nbsp;</td><td style="color:${C.textDim}">14d&nbsp;</td><td style="text-align:right"><b>${Math.round(seg.middle)}</b></td></tr><tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bar.color};opacity:0.25;margin-right:4px"></span>Expiring&nbsp;</td><td style="color:${C.textDim}">7d&nbsp;</td><td style="text-align:right"><b>${Math.round(seg.expiring)}</b></td></tr></table>`;
	}
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<Tip text={"Your 4-week training load broken into three types.\nEach has a personalized target range.\n\nLeft (bright) = last 7 days · Middle = 14 days · Right (faded) = expiring in 7 days\n\nAll three in range = balanced training."}>
		<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Scales size={14} weight="bold" /> Load Balance</h2>
	</Tip>

	<div class="flex-1 min-h-[160px]">
	<table class="w-full h-full" style="border-collapse: separate; border-spacing: 0 8px;">
		<tbody>
		{#each bars() as bar}
			{@const max = scaleMax(bars())}
			{@const zoneLeft = (bar.min / max) * 100}
			{@const zoneWidth = ((bar.max - bar.min) / max) * 100}
			<tr>
				<td class="pr-3 whitespace-nowrap align-middle">
					<Tip text={barTips[bar.label]}>
						<span class="text-xs font-medium text-text-secondary">{bar.label}</span>
					</Tip>
				</td>
				<td class="w-full align-middle">
					<Tip text="" html={tooltipHtml(bar)}>
					<div class="relative h-5 rounded bg-card-border">
						{#each [bar.segments] as seg}
							{@const recentW = Math.min((seg.recent / max) * 100, 100)}
							{@const middleW = Math.min((seg.middle / max) * 100, 100)}
							{@const expiringW = Math.min((seg.expiring / max) * 100, 100)}
							{#if recentW > 0}
								<div class="absolute left-0 top-0 h-full transition-all" style="width: {recentW}%; background: {bar.color}; opacity: 0.9; border-radius: {middleW + expiringW <= 0 ? '4px' : '4px 0 0 4px'};"></div>
							{/if}
							{#if middleW > 0}
								<div class="absolute top-0 h-full transition-all" style="left: {recentW}%; width: {middleW}%; background: {bar.color}; opacity: 0.55; {recentW <= 0 && expiringW <= 0 ? 'border-radius: 4px;' : recentW <= 0 ? 'border-radius: 4px 0 0 4px;' : expiringW <= 0 ? 'border-radius: 0 4px 4px 0;' : ''}"></div>
							{/if}
							{#if expiringW > 0}
								<div class="absolute top-0 h-full transition-all" style="left: {recentW + middleW}%; width: {expiringW}%; background: {bar.color}; opacity: 0.25; border-radius: {recentW + middleW <= 0 ? '4px' : '0 4px 4px 0'};"></div>
							{/if}
						{/each}
						<div
							class="absolute z-10 pointer-events-none"
							style="left: {zoneLeft}%; top: -3px; bottom: -3px; width: 2px; transform: translateX(-50%); background: {bar.value < bar.min ? C.red : C.text}; box-shadow: 0 0 0 1px {C.card}; border-radius: 1px;"
						></div>
						<div
							class="absolute z-10 pointer-events-none"
							style="left: {zoneLeft + zoneWidth}%; top: -3px; bottom: -3px; width: 2px; transform: translateX(-50%); background: {bar.value > bar.max ? C.red : C.text}; box-shadow: 0 0 0 1px {C.card}; border-radius: 1px;"
						></div>
					</div>
					</Tip>
				</td>
				<td class="pl-3 whitespace-nowrap align-middle text-right">
					<span class="num text-xs font-medium" style="color: {deltaColor(bar.value, bar.min, bar.max)}">
						{delta(bar.value, bar.min, bar.max)}
					</span>
				</td>
			</tr>
		{/each}
		</tbody>
	</table>
	</div>

	{#if hrZones.length > 0}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 mt-auto border-t border-card-border/30 text-[10px]">
			{#each [1, 2, 3, 4, 5] as z}
				{@const hz = hrZones.find(h => h.zone === z)}
				{#if hz}
					<Tip text={ZONE_TIPS[z]}>
						<span class="num text-text-dim"><span class="font-semibold" style="color: {ZONE_COLORS[z - 1]}">Z{z}</span> {hz.min_bpm}–{hz.max_bpm == null ? (maxHr ?? '?') : hz.max_bpm}</span>
					</Tip>
				{/if}
			{/each}
			{#if lactateHr}
				<Tip text={"Lactate Threshold heart rate.\nAbove LT = anaerobic, time-limited.\nBelow LT = aerobic, sustainable."}>
					<span class="num text-text-dim"><span class="font-semibold" style="color: {C.red}">LT</span> {lactateHr}{#if lactatePace}&nbsp;{lactatePace}/km{/if}</span>
				</Tip>
			{/if}
		</div>
	{/if}
</div>
