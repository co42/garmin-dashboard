<script lang="ts">
	import type { Readiness } from '$lib/types.js';
	import { C, readinessColor, readinessLabel } from '$lib/colors.js';
	import { resolveReadiness } from '$lib/readiness.js';
	import Gauge from 'phosphor-svelte/lib/Gauge';
	import Tip from './Tip.svelte';

	interface Props {
		readiness: Readiness;
	}

	let { readiness }: Props = $props();

	const latest = $derived(readiness.latest ?? readiness.post_activity ?? readiness.morning);
	const entry = $derived(latest ?? resolveReadiness(readiness));
	const hasBoth = $derived(!!readiness.morning && !!readiness.post_activity);

	const factorTips: Record<string, string> = {
		HRV: 'Heart rate variability vs your personal baseline. Higher HRV = more recovered autonomic nervous system.',
		Sleep: 'Sleep quality trend over the last 3 nights. Consistently poor sleep impairs adaptation to training.',
		Recovery: 'Time since your last hard effort. Shows whether your body has had enough time to rebuild.',
		Stress: 'All-day stress levels from HRV monitoring. Chronic high stress competes with training adaptation.',
		ACWR: 'Whether your recent training load is in balance with your long-term load. Optimal ACWR supports readiness.',
	};

	const factors = $derived([
		{ label: 'HRV', value: entry.hrv_score },
		{ label: 'Sleep', value: entry.sleep_history_score },
		{ label: 'Recovery', value: entry.recovery_score },
		{ label: 'Stress', value: entry.stress_score },
		{ label: 'ACWR', value: entry.acwr_score },
	]);

	const color = $derived(readinessColor(entry.score));

	function barColor(value: number): string {
		return readinessColor(value);
	}
</script>

<div class="rounded-lg bg-card p-3 md:p-4 h-full flex flex-col">
	<Tip text={"How ready is your body to train today?\n\n95–100% = Prime\n75–94% = High\n50–74% = Moderate\n25–49% = Low\n0–24% = Poor\n\nComputed from HRV, sleep, recovery time, stress, and ACWR."}>
		<h2 class="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
			<Gauge size={14} weight="bold" /> Readiness
			<span class="ml-auto flex items-center gap-1.5">
				<span class="num text-xs font-bold" style="color: {color}">{entry.score}%</span>
				<span class="text-[10px] font-semibold" style="color: {color}">{readinessLabel(entry.score)}</span>
				{#if hasBoth && readiness.morning}
					<span class="text-[10px] text-text-dim font-normal">morning {readiness.morning.score}%</span>
				{/if}
			</span>
		</h2>
	</Tip>

	<div class="flex flex-col flex-1">
		<!-- Factor bars -->
		<div class="flex-1 flex flex-col justify-center space-y-2.5">
			{#each factors as factor}
				<div class="grid items-center gap-2" style="grid-template-columns: 52px 1fr 24px;">
					<Tip text={factorTips[factor.label]}>
						<span class="block text-right text-[11px] text-text-secondary">{factor.label}</span>
					</Tip>
					<div class="relative h-1.5 rounded-full bg-card-border">
						<div
							class="absolute left-0 top-0 h-full rounded-full"
							style="width: {factor.value}%; background: {barColor(factor.value)};"
						></div>
					</div>
					<span class="num text-right text-[11px] font-medium text-text">{factor.value}%</span>
				</div>
			{/each}
		</div>
	</div>
</div>
