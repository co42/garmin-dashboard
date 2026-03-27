<script lang="ts">
	import type { DailyTrainingStatus, Readiness } from '$lib/types.js';
	import { C, statusColor, acwrColor, fitnessTrend, readinessColor, readinessLabel } from '$lib/colors.js';
	import { resolveReadiness } from '$lib/readiness.js';
	import Tip from './Tip.svelte';

	interface Props {
		status: DailyTrainingStatus;
		readiness: Readiness;
		daysSinceLastRun: number | null;
	}

	let { status, readiness, daysSinceLastRun }: Props = $props();

	const color = $derived(statusColor(status.status));
	const acwrC = $derived(acwrColor(status.acwr_status));
	const trend = $derived(fitnessTrend(status.fitness_trend));
	const latest = $derived(readiness.post_activity ?? readiness.morning);
	const latestColor = $derived(latest ? readinessColor(latest.score) : C.textDim);

	function fmt(s: string): string {
		return s.replace(/_\d+$/, '').split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
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

<div class="rounded-lg bg-card p-5">
	<!-- Top: Status + ACWR + Days off | Readiness + Recovery -->
	<div class="flex flex-wrap items-center gap-x-6 gap-y-3">
		<!-- Left: Training status -->
		<div class="flex flex-wrap items-center gap-x-5 gap-y-2">
			<div>
				<Tip text={"Decided by two axes:\n• VO2max trend — are you getting fitter?\n• ACWR — are you training enough?\n\nProductive = VO2max improving + ACWR 0.8–1.3."}>
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Status</span>
				</Tip>
				<p class="text-xl font-bold" style="color: {color}">{fmt(status.status)}</p>
				<span class="text-xs text-text-secondary">{fmt(status.load_balance_feedback)}</span>
			</div>

			<Tip text={"Acute:Chronic Workload Ratio\n7-day load ÷ 28-day average.\n\n< 0.8 = undertraining\n0.8–1.3 = optimal\n> 1.3 = overreaching risk\n\nCurrently " + status.acute_load + " acute / " + status.chronic_load + " chronic."}>
				<div class="flex items-center gap-1.5">
					<span class="text-lg" style="color: {acwrC}">●</span>
					<div>
						<span class="text-xs text-text-secondary">ACWR</span>
						<p class="num text-sm font-medium text-text">{status.acwr.toFixed(1)} <span class="text-xs font-normal text-text-secondary">{status.acwr_status.toLowerCase()}</span></p>
					</div>
				</div>
			</Tip>

			<Tip text={"Computed from VO2max history over ~4 weeks.\nImproving = getting fitter\nSteady = plateauing\nDeclining = losing fitness"}>
				<div class="flex items-center gap-1.5">
					<span class="text-lg" style="color: {trend.color}">{trend.arrow}</span>
					<div>
						<span class="text-xs text-text-secondary">VO2max</span>
						<p class="num text-sm font-medium text-text">{status.vo2max_precise.toFixed(1)}</p>
					</div>
				</div>
			</Tip>
		</div>

		<!-- Right: Readiness + Recovery + Last run -->
		<div class="ml-auto flex items-center gap-4">
			<Tip text={"How ready is your body to train today?\n\n95–100% = Prime\n75–94% = High\n50–74% = Moderate\n25–49% = Low\n0–24% = Poor" + (readiness.morning && readiness.post_activity ? "\n\nMorning: " + readiness.morning.score + "%" : "")}>
				<div class="text-right">
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Readiness</span>
					<p class="num text-xl font-bold">
						<span style="color: {latestColor}">{latest ? latest.score + '%' : '—'}</span>
					</p>
				</div>
			</Tip>
			<div class="h-8 w-px bg-card-border"></div>
			<Tip text={"Time until Garmin estimates full recovery from recent training." + (readiness.morning && readiness.post_activity ? "\n\nMorning: " + recoveryTime(readiness.morning.recovery_time_minutes) : "")}>
				<div class="text-right">
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Recovery</span>
					<p class="num text-xl font-bold text-text">
						{recoveryTime(latest?.recovery_time_minutes ?? 0)}
					</p>
				</div>
			</Tip>
			{#if daysSinceLastRun != null}
				<div class="h-8 w-px bg-card-border"></div>
				<Tip text="Gaps longer than 7–10 days start causing measurable fitness loss.">
					<div class="text-right">
						<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Last run</span>
						<p class="num text-xl font-bold text-text">{daysSinceLastRun}d</p>
					</div>
				</Tip>
			{/if}
		</div>
	</div>

</div>
