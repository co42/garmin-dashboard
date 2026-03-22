<script lang="ts">
	import type { RacePredictions as RPType } from '$lib/types.js';
	import { formatRaceTime } from '$lib/format.js';
	import Tip from './Tip.svelte';

	interface Props {
		predictions: RPType;
	}

	let { predictions }: Props = $props();

	const races = $derived([
		{ label: '5K', time: predictions.time_5k_seconds, pace: predictions.pace_5k },
		{ label: '10K', time: predictions.time_10k_seconds, pace: predictions.pace_10k },
		{ label: 'Half', time: predictions.time_half_marathon_seconds, pace: predictions.pace_half_marathon },
		{ label: 'Full', time: predictions.time_marathon_seconds, pace: predictions.pace_marathon },
	]);
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text="Predicted finish times based on your current VO2max. These assume ideal race conditions and proper pacing. Actual times depend on terrain, weather, taper, and race execution.">
		<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Race Predictions</span>
	</Tip>
	<div class="mt-2 grid grid-cols-2 gap-2">
		{#each races as race}
			<div class="rounded bg-card-border/50 px-2.5 py-1.5">
				<span class="text-[10px] font-semibold uppercase text-text-dim">{race.label}</span>
				<p class="text-sm font-bold text-text">{formatRaceTime(race.time)}</p>
				<p class="text-[10px] text-text-secondary">{race.pace} /km</p>
			</div>
		{/each}
	</div>
</div>
