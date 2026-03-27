<script lang="ts">
	import type { RacePredictions, PersonalRecord } from '$lib/types.js';
	import { formatTime } from '$lib/format.js';
	import { C } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Timer from 'phosphor-svelte/lib/Timer';
	import Trophy from 'phosphor-svelte/lib/Trophy';
	import TrendUp from 'phosphor-svelte/lib/TrendUp';

	interface Props {
		predictions: RacePredictions;
		records: PersonalRecord[];
	}

	let { predictions, records }: Props = $props();

	const DISTANCES = $derived([
		{ label: '5K', km: 5, typeId: 3, predTime: predictions.time_5k_seconds, predPace: predictions.pace_5k },
		{ label: '10K', km: 10, typeId: 4, predTime: predictions.time_10k_seconds, predPace: predictions.pace_10k },
		{ label: 'Semi', km: 21.0975, typeId: 5, predTime: predictions.time_half_marathon_seconds, predPace: predictions.pace_half_marathon },
		{ label: 'Marathon', km: 42.195, typeId: 6, predTime: predictions.time_marathon_seconds, predPace: predictions.pace_marathon },
	]);

	const recordMap = $derived(new Map(records.map(r => [r.type_id, r])));

	function pace(seconds: number, km: number): string {
		const p = seconds / km;
		return `${Math.floor(p / 60)}:${Math.floor(p % 60).toString().padStart(2, '0')} /km`;
	}

	function yearLabel(date: string): string {
		const d = new Date(date);
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	function isRecent(date: string): boolean {
		return Date.now() - new Date(date).getTime() < 30 * 86400000;
	}
</script>

<div>
	<div class="mb-3 flex items-center justify-between">
		<Tip text={"PR = your actual best time from a real run.\nPredicted = Garmin estimate from current VO2max — tracks current fitness, drops when you detrain."}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Timer size={14} weight="bold" /> Race Times</h2>
		</Tip>
		{#if predictions.date}
			<span class="num text-xs text-text-secondary">{new Date(predictions.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
		{#each DISTANCES as dist}
			{@const pr = recordMap.get(dist.typeId)}
			{@const recent = pr ? isRecent(pr.date) : false}
			<div class="rounded-lg bg-card px-4 py-3" style={recent ? 'box-shadow: 0 0 0 1px rgba(34,197,94,0.3);' : ''}>
				<div class="mb-2 flex items-baseline justify-between">
					<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary">{dist.label}</span>
					{#if pr}
						<span class="num text-[10px] text-text-dim">{yearLabel(pr.date)}{#if recent}<span style="color: {C.green}"> NEW</span>{/if}</span>
					{/if}
				</div>

			{#if pr}
					<div class="flex items-center gap-2">
						<Trophy size={16} weight="bold" class="text-text-dim shrink-0" />
						<span class="num text-lg font-bold text-text">{formatTime(pr.value)}</span>
						<span class="num text-sm text-text-secondary ml-auto">{pace(pr.value, dist.km)}</span>
					</div>
				{:else}
					<div class="flex items-center gap-2 text-sm text-text-dim"><Trophy size={16} weight="bold" class="shrink-0" /> no PR</div>
				{/if}

				<div class="mt-2 flex items-center gap-2 border-t border-card-border/50 pt-2">
					<TrendUp size={16} weight="bold" class="text-text-dim shrink-0" />
					<span class="num text-lg font-bold text-text-dim">{formatTime(dist.predTime)}</span>
					<span class="num text-sm text-text-dim ml-auto">{dist.predPace} /km</span>
				</div>
			</div>
		{/each}
	</div>
</div>
