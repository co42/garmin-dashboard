<script lang="ts">
	import type { RacePredictions as RPType } from '$lib/types.js';
	import Tip from './Tip.svelte';
	import Target from 'phosphor-svelte/lib/Target';

	interface Props {
		predictions: RPType;
	}

	let { predictions }: Props = $props();

	function fmtHms(secs: number | null): string {
		if (!secs) return '—';
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = Math.round(secs % 60);
		return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
	}

	function fmtPace(secs: number | null, distanceM: number): string {
		if (!secs || !distanceM) return '—';
		const secsPerKm = Math.round(secs / (distanceM / 1000));
		return `${Math.floor(secsPerKm / 60)}:${String(secsPerKm % 60).padStart(2, '0')}`;
	}

	const races = $derived([
		{ label: '5K', secs: predictions.time_5k_seconds, dist: 5000 },
		{ label: '10K', secs: predictions.time_10k_seconds, dist: 10000 },
		{ label: 'Half', secs: predictions.time_half_marathon_seconds, dist: 21097.5 },
		{ label: 'Full', secs: predictions.time_marathon_seconds, dist: 42195 },
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
				<p class="num text-sm font-bold text-text">{fmtHms(race.secs)}</p>
				<p class="num text-[10px] text-text-secondary">{fmtPace(race.secs, race.dist)} /km</p>
			</div>
		{/each}
	</div>
</div>
