<script lang="ts">
	import type { DailyTrainingStatus, Readiness } from '$lib/types.js';
	import { statusColor, acwrColor, fitnessTrend, readinessColor } from '$lib/colors.js';
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
	const readyColor = $derived(readinessColor(readiness.score));

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
		if (fb === 'VERY_GOOD' || fb === 'GOOD') return '#22c55e';
		if (fb === 'FAIR') return '#f59e0b';
		if (fb === 'POOR') return '#ef4444';
		return '#555568';
	}

</script>

<div
	class="rounded-lg bg-card p-5"
	style="border-left: 4px solid {color}; background: linear-gradient(90deg, {color}08, transparent 40%);"
>
	<!-- Top: Status + ACWR + Days off | Readiness + Recovery -->
	<div class="flex flex-wrap items-start gap-x-6 gap-y-3">
		<!-- Left: Training status -->
		<div class="flex flex-wrap items-center gap-x-5 gap-y-2">
			<div>
				<Tip text={"Decided by two axes:\n• VO2max trend — are you getting fitter?\n• ACWR — are you training enough?\n\nProductive = VO2max improving + ACWR 0.8–1.3."}>
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Status</span>
				</Tip>
				<p class="text-xl font-bold" style="color: {color}">{fmt(status.status)}</p>
			</div>

			<Tip text={"Acute:Chronic Workload Ratio\n7-day load ÷ 28-day average.\n\n< 0.8 = undertraining\n0.8–1.3 = optimal\n> 1.3 = overreaching risk\n\nCurrently " + status.acute_load + " acute / " + status.chronic_load + " chronic."}>
				<div class="flex items-center gap-2 rounded-full px-3 py-1.5" style="background: {acwrC}18; border: 1px solid {acwrC}40;">
					<span class="num text-sm font-semibold" style="color: {acwrC}">ACWR {status.acwr.toFixed(1)}</span>
					<span class="text-xs text-text-secondary">{status.acwr_status}</span>
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
			<Tip text={"How ready is your body to train today? (0–100)\n\n70+ = push hard\n40–69 = moderate\n< 40 = rest"}>
				<div class="text-right">
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Readiness</span>
					<p class="num text-xl font-bold" style="color: {readyColor}">{readiness.score}</p>
				</div>
			</Tip>
			<div class="h-8 w-px bg-card-border"></div>
			<Tip text="Time until Garmin estimates full recovery from recent training.">
				<div class="text-right">
					<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Recovery</span>
					<p class="num text-xl font-bold text-text">{recoveryTime(readiness.recovery_time_hours)}</p>
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

	<!-- Bottom: load balance feedback only -->
	<div class="mt-3 border-t border-card-border/50 pt-3">
		<span class="text-xs text-text-secondary">{fmt(status.load_balance_feedback)}</span>
	</div>
</div>
