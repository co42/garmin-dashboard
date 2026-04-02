<script lang="ts">
	import type { DailyTrainingStatus, Readiness } from '$lib/types.js';
	import { C, statusColor, acwrColor, fitnessTrend, readinessColor, readinessLabel } from '$lib/colors.js';
	import { resolveReadiness } from '$lib/readiness.js';
	import Tip from './Tip.svelte';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import XCircle from 'phosphor-svelte/lib/XCircle';
	import TrendUp from 'phosphor-svelte/lib/TrendUp';
	import TrendDown from 'phosphor-svelte/lib/TrendDown';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';

	interface Props {
		status: DailyTrainingStatus;
		statusHistory: DailyTrainingStatus[];
		readiness: Readiness;
		daysSinceLastRun: number | null;
	}

	let { status, statusHistory, readiness, daysSinceLastRun }: Props = $props();

	const sortedHistory = $derived([...statusHistory].sort((a, b) => a.date.localeCompare(b.date)));
	let timelineTip = $state<{ text: string; x: number } | null>(null);

	const color = $derived(statusColor(status.status));
	const acwrC = $derived(acwrColor(status.acwr_status));
	const trend = $derived(fitnessTrend(status.fitness_trend));
	const latest = $derived(readiness.latest ?? readiness.post_activity ?? readiness.morning);
	const latestColor = $derived(latest ? readinessColor(latest.score) : C.textDim);

	function fmt(s: string): string {
		return s.replace(/_\d+$/, '').split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
	}

	/** Compute remaining recovery from the snapshot value + its timestamp */
	function remainingRecovery(entry: { recovery_time_minutes: number; timestamp_local?: string } | null): number {
		if (!entry || entry.recovery_time_minutes <= 0) return 0;
		if (!entry.timestamp_local) return entry.recovery_time_minutes;
		const elapsed = (Date.now() - new Date(entry.timestamp_local).getTime()) / 60000;
		return Math.max(0, Math.round(entry.recovery_time_minutes - elapsed));
	}

	function recoveryTime(minutes: number): string {
		if (minutes <= 0) return 'ready';
		const h = Math.floor(minutes / 60);
		const d = Math.floor(h / 24);
		const rh = h % 24;
		if (d > 0) return `${d}d ${rh}h`;
		return `${h}h`;
	}

	function feedbackColor(fb: string): string {
		if (fb === 'VERY_GOOD' || fb === 'GOOD') return C.green;
		if (fb === 'FAIR') return C.amber;
		if (fb === 'POOR') return C.red;
		return C.textDim;
	}

</script>

<div class="rounded-lg bg-card p-3 md:p-5">
	<!-- Top: Status + ACWR + Days off | Readiness + Recovery -->
	<div class="flex flex-col md:flex-row md:items-center gap-3 md:gap-x-6">
		<!-- Left: Training status -->
		<div class="flex items-center gap-x-5 gap-y-2">
			<Tip text={"Decided by two axes:\n• VO2max trend — are you getting fitter?\n• ACWR — are you training enough?\n\nProductive = VO2max improving + ACWR 0.8–1.3."}>
				<div class="text-center">
					<p class="text-xl font-bold" style="color: {color}">{fmt(status.status)}</p>
					<span class="text-xs" style="color: {color}">{fmt(status.load_balance_feedback)}</span>
				</div>
			</Tip>

			<Tip text={"Acute:Chronic Workload Ratio\n7-day load ÷ 28-day average.\n\n< 0.8 = undertraining\n0.8–1.3 = optimal\n> 1.3 = overreaching risk\n\nCurrently " + status.acute_load + " acute / " + status.chronic_load + " chronic."}>
				<div>
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">ACWR</span>
					<p class="num text-xl font-bold text-text flex items-center gap-1">{status.acwr.toFixed(1)} <span style="color: {acwrC}">{#if status.acwr_status === 'OPTIMAL'}<CheckCircle size={16} weight="bold" />{:else if status.acwr_status === 'HIGH' || status.acwr_status === 'LOW'}<WarningCircle size={16} weight="bold" />{:else}<XCircle size={16} weight="bold" />{/if}</span></p>
				</div>
			</Tip>

			<Tip text={"Computed from VO2max history over ~4 weeks.\nImproving = getting fitter\nSteady = plateauing\nDeclining = losing fitness"}>
				<div>
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">VO2max</span>
					<p class="num text-xl font-bold text-text flex items-center gap-1">{status.vo2max_precise.toFixed(1)} <span style="color: {trend.color}">{#if trend.arrow === '↑'}<TrendUp size={16} weight="bold" />{:else if trend.arrow === '↓'}<TrendDown size={16} weight="bold" />{:else}<ArrowRight size={16} weight="bold" />{/if}</span></p>
				</div>
			</Tip>
		</div>

		<!-- Right: Readiness + Recovery + Last run -->
		<div class="md:ml-auto flex items-center gap-3 md:gap-4">
			<Tip text={"How ready is your body to train today?\n\n95–100% = Prime\n75–94% = High\n50–74% = Moderate\n25–49% = Low\n0–24% = Poor" + (readiness.morning && readiness.post_activity ? "\n\nMorning: " + readiness.morning.score + "%" : "")}>
				<div class="md:text-right">
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Readiness</span>
					<p class="num text-xl font-bold" style="color: {latestColor}">{latest ? latest.score + '%' : '—'}</p>
				</div>
			</Tip>
			<div class="hidden md:block h-8 w-px bg-card-border"></div>
			<Tip text={"Time until Garmin estimates full recovery from recent training.\nCounts down from the last readiness snapshot." + (readiness.morning && readiness.post_activity ? "\n\nMorning: " + recoveryTime(readiness.morning.recovery_time_minutes) : "")}>
				<div class="md:text-right">
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Recovery</span>
					<p class="num text-xl font-bold text-text">
						{recoveryTime(remainingRecovery(latest))}
					</p>
				</div>
			</Tip>
			{#if daysSinceLastRun != null}
				<div class="hidden md:block h-8 w-px bg-card-border"></div>
				<Tip text="Gaps longer than 7–10 days start causing measurable fitness loss.">
					<div class="md:text-right">
						<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Last run</span>
						<p class="num text-xl font-bold text-text">{daysSinceLastRun}d</p>
					</div>
				</Tip>
			{/if}
		</div>
	</div>

	<!-- Training status timeline -->
	{#if sortedHistory.length > 1}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex mt-4 h-2 rounded-full overflow-hidden gap-px"
			onmouseleave={() => { timelineTip = null; }}
		>
			{#each sortedHistory as day, i}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="flex-1"
					style="background: {statusColor(day.status)}"
					onmouseenter={(e) => { timelineTip = { text: day.date.slice(5) + ' · ' + fmt(day.status), x: (e.currentTarget as HTMLElement).offsetLeft + (e.currentTarget as HTMLElement).offsetWidth / 2 }; }}
				></div>
			{/each}
		</div>
		{#if timelineTip}
			<div
				class="relative pointer-events-none"
				style="height: 0;"
			>
				<span
					class="absolute -top-1 text-[11px] text-text-secondary bg-card-border/90 px-2 py-0.5 rounded whitespace-nowrap -translate-x-1/2"
					style="left: {timelineTip.x}px;"
				>{timelineTip.text}</span>
			</div>
		{/if}
	{/if}

</div>
