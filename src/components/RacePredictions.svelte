<script lang="ts">
	import type { RacePredictions as RPType } from '$lib/types.js';
	import Tip from './Tip.svelte';
	import Target from 'phosphor-svelte/lib/Target';

	interface Props {
		predictions: RPType;
	}

	let { predictions }: Props = $props();

	const races = $derived([
		{ label: '5K', time: predictions.time_5k, pace: predictions.pace_5k },
		{ label: '10K', time: predictions.time_10k, pace: predictions.pace_10k },
		{ label: 'Half', time: predictions.time_half_marathon, pace: predictions.pace_half_marathon },
		{ label: 'Full', time: predictions.time_marathon, pace: predictions.pace_marathon },
	]);
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text="Predicted finish times based on your current VO2max. These assume ideal race conditions and proper pacing. Actual times depend on terrain, weather, taper, and race execution.">
		<span class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Target size={14} weight="bold" /> Race Predictions</span>
	</Tip>
	<div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
		{#each races as race}
			<div class="rounded bg-card-border/50 px-2.5 py-1.5">
				<span class="text-[10px] font-semibold uppercase text-text-dim">{race.label}</span>
				<p class="num text-sm font-bold text-text">{race.time}</p>
				<p class="num text-[10px] text-text-secondary">{race.pace} /km</p>
			</div>
		{/each}
	</div>
</div>
