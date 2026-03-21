<script lang="ts">
	import type { RacePredictions as RPType } from '$lib/types.js';
	import { formatRaceTime, formatRacePace } from '$lib/format.js';

	interface Props {
		predictions: RPType;
	}

	let { predictions }: Props = $props();

	const races = $derived([
		{ label: '5K', time: predictions.time5K, km: 5 },
		{ label: '10K', time: predictions.time10K, km: 10 },
		{ label: 'Half', time: predictions.timeHalfMarathon, km: 21.0975 },
		{ label: 'Full', time: predictions.timeMarathon, km: 42.195 },
	]);
</script>

<div class="rounded-lg bg-card p-4">
	<span class="text-xs font-medium uppercase tracking-wider text-text-secondary">Race Predictions</span>
	<div class="mt-2 grid grid-cols-2 gap-2">
		{#each races as race}
			<div class="rounded bg-card-border/50 px-2.5 py-1.5">
				<span class="text-[10px] font-semibold uppercase text-text-dim">{race.label}</span>
				<p class="text-sm font-bold text-text">{formatRaceTime(race.time)}</p>
				<p class="text-[10px] text-text-secondary">{formatRacePace(race.time, race.km)}</p>
			</div>
		{/each}
	</div>
</div>
