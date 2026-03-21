<script lang="ts">
	import type { TrainingStatusData, VO2Max } from '$lib/types.js';
	import { STATUS_COLORS, FITNESS_TREND_LABEL } from '$lib/colors.js';

	interface Props {
		status: TrainingStatusData;
		vo2max: VO2Max;
		daysSinceLastRun: number | null;
	}

	let { status, vo2max, daysSinceLastRun }: Props = $props();

	const phrase = $derived(status.trainingStatusFeedbackPhrase);
	const color = $derived(STATUS_COLORS[phrase] ?? '#8888a0');
	const acwr = $derived(status.acuteTrainingLoadDTO);
	const trend = $derived(FITNESS_TREND_LABEL[status.fitnessTrend] ?? FITNESS_TREND_LABEL[0]);

	const acwrColor = $derived(
		acwr.acwrStatus === 'LOW' ? '#3b82f6'
		: acwr.acwrStatus === 'OPTIMAL' ? '#22c55e'
		: acwr.acwrStatus === 'HIGH' ? '#f59e0b'
		: '#ef4444'
	);

	function formatStatus(s: string): string {
		return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
	}
</script>

<div
	class="rounded-lg bg-card p-5"
	style="border-left: 4px solid {color}; background: linear-gradient(90deg, {color}08, transparent 40%);"
>
	<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
		<!-- Training Status -->
		<div>
			<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Training Status</span>
			<p class="text-xl font-bold" style="color: {color}">{formatStatus(phrase)}</p>
		</div>

		<!-- ACWR Pill -->
		<div
			class="flex items-center gap-2 rounded-full px-3 py-1.5"
			style="background: {acwrColor}18; border: 1px solid {acwrColor}40;"
		>
			<span class="text-sm font-semibold" style="color: {acwrColor}">
				ACWR {acwr.dailyAcuteChronicWorkloadRatio.toFixed(1)}
			</span>
			<span class="text-xs text-text-secondary">{acwr.acwrStatus}</span>
		</div>

		<!-- Days Since Last Run -->
		{#if daysSinceLastRun != null}
			<div class="flex items-center gap-1.5">
				<span class="text-2xl font-bold text-text">
					{daysSinceLastRun}
				</span>
				<span class="text-xs text-text-secondary leading-tight">days since<br/>last run</span>
			</div>
		{/if}

		<!-- Fitness Trend -->
		<div class="flex items-center gap-1.5">
			<span class="text-lg" style="color: {trend.color}">{trend.arrow}</span>
			<div>
				<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">VO2max Trend</span>
				<p class="text-sm font-medium" style="color: {trend.color}">{trend.label}</p>
			</div>
		</div>

		<!-- VO2max quick stat -->
		<div class="ml-auto text-right">
			<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">VO2max</span>
			<p class="text-xl font-bold text-text">{vo2max.vo2MaxPreciseValue.toFixed(1)}</p>
		</div>
	</div>
</div>
