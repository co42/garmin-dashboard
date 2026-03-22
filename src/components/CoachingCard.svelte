<script lang="ts">
	import type { Readiness, DailyTrainingStatus } from '$lib/types.js';
	import { readinessColor } from '$lib/colors.js';
	import Tip from './Tip.svelte';

	interface Props {
		readiness: Readiness;
		status: DailyTrainingStatus;
	}

	let { readiness, status }: Props = $props();

	const color = $derived(readinessColor(readiness.score));

	function fmt(s: string): string {
		return s.toLowerCase().replace(/_\d+$/, '').replace(/_/g, ' ');
	}

	function recoveryTime(hours: number): string {
		if (hours <= 0) return 'none';
		const d = Math.floor(hours / 24);
		const h = Math.round(hours % 24);
		if (d > 0) return `${d}d ${h}h`;
		return `${h}h`;
	}

	const factors = $derived([
		{ label: 'Recovery', feedback: readiness.recovery_feedback },
		{ label: 'HRV', feedback: readiness.hrv_feedback },
		{ label: 'Sleep', feedback: readiness.sleep_feedback },
		{ label: 'Sleep history', feedback: readiness.sleep_history_feedback },
		{ label: 'Stress', feedback: readiness.stress_feedback },
		{ label: 'ACWR', feedback: readiness.acwr_feedback },
	]);

	function feedbackColor(fb: string): string {
		switch (fb) {
			case 'VERY_GOOD': return '#22c55e';
			case 'GOOD': return '#22c55e';
			case 'FAIR': return '#f59e0b';
			case 'POOR': return '#ef4444';
			default: return '#555568';
		}
	}
</script>

<div class="rounded-lg bg-card p-4 h-full">
	<Tip text={"Garmin's own feedback phrases — no interpretation added.\nStatus = VO2max trend × ACWR.\nReadiness factors show what's helping or hurting today."}>
		<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">Garmin says</h2>
	</Tip>

	<!-- Readiness headline -->
	<div class="mb-3 flex items-center gap-3">
		<span class="num text-2xl font-bold" style="color: {color}">{readiness.score}</span>
		<div>
			<span class="text-sm font-semibold text-text">{readiness.level}</span>
			<span class="text-sm text-text-secondary"> · {fmt(readiness.feedback)}</span>
		</div>
		<span class="num ml-auto text-xs text-text-dim">recovery {recoveryTime(readiness.recovery_time_hours)}</span>
	</div>

	<!-- Status + load feedback -->
	<div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
		<span class="text-text-secondary">
			Status: <span class="font-medium text-text">{fmt(status.status)}</span>
		</span>
		<span class="text-text-secondary">
			Load: <span class="font-medium text-text">{fmt(status.load_balance_feedback)}</span>
		</span>
		<span class="text-text-secondary">
			ACWR: <span class="font-medium text-text">{status.acwr_status.toLowerCase()}</span>
		</span>
	</div>

	<!-- Factor pills -->
	<div class="flex flex-wrap gap-2">
		{#each factors as f}
			{#if f.feedback && f.feedback !== 'NONE'}
				<span class="rounded px-2 py-0.5 text-[10px] font-medium" style="background: {feedbackColor(f.feedback)}15; color: {feedbackColor(f.feedback)}">
					{f.label}: {fmt(f.feedback)}
				</span>
			{/if}
		{/each}
	</div>
</div>
