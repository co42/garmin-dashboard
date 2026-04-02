<script lang="ts">
	import type { RacePredictions, PersonalRecord, Activity } from '$lib/types.js';
	import { formatTime } from '$lib/format.js';
	import { C } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Timer from 'phosphor-svelte/lib/Timer';
	import Trophy from 'phosphor-svelte/lib/Trophy';
	import TrendUp from 'phosphor-svelte/lib/TrendUp';

	interface Props {
		predictions: RacePredictions;
		records: PersonalRecord[];
		activities?: Activity[];
		onNavigate?: (activityId: number) => void;
	}

	let { predictions, records, activities = [], onNavigate }: Props = $props();
	const activityMap = $derived(new Map(activities.map(a => [a.id, a])));

	const DISTANCES = $derived([
		{ label: '5K', km: 5, recordType: '5K Run', predTime: predictions.time_5k_seconds, predTimeStr: predictions.time_5k, predPace: predictions.pace_5k },
		{ label: '10K', km: 10, recordType: '10K Run', predTime: predictions.time_10k_seconds, predTimeStr: predictions.time_10k, predPace: predictions.pace_10k },
		{ label: 'Semi', km: 21.0975, recordType: 'Half Marathon', predTime: predictions.time_half_marathon_seconds, predTimeStr: predictions.time_half_marathon, predPace: predictions.pace_half_marathon },
		{ label: 'Marathon', km: 42.195, recordType: 'Full Marathon', predTime: predictions.time_marathon_seconds, predTimeStr: predictions.time_marathon, predPace: predictions.pace_marathon },
	]);

	const recordMap = $derived(new Map(records.map(r => [r.record_type, r])));

	function pace(seconds: number, km: number): string {
		const p = seconds / km;
		return `${Math.floor(p / 60)}:${Math.floor(p % 60).toString().padStart(2, '0')} /km`;
	}

	function yearLabel(date: string): string {
		const d = new Date(date.includes('T') ? date : date.slice(0, 10) + 'T12:00:00Z');
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
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
			<span class="num text-xs text-text-secondary">{new Date(predictions.date.includes('T') ? predictions.date : predictions.date.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>
		{/if}
	</div>

	<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
		{#each DISTANCES as dist}
			{@const pr = recordMap.get(dist.recordType)}
			{@const recent = pr?.date ? isRecent(pr.date) : false}
			{@const prActivity = pr?.activity_id ? activityMap.get(pr.activity_id) : undefined}
			{@const location = prActivity?.location_name}
			<div class="rounded-lg bg-card px-3 md:px-4 py-3" style={recent ? 'box-shadow: 0 0 0 1px rgba(34,197,94,0.3);' : ''}>
				<div class="mb-2 flex items-baseline justify-between gap-2 min-w-0">
					<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary shrink-0">{dist.label}</span>
					{#if pr?.date}
						{#if pr.activity_id && onNavigate}
							<button type="button" class="num text-[10px] text-text-dim cursor-pointer hover:text-text-secondary transition-colors truncate min-w-0" onclick={() => onNavigate(pr.activity_id!)}>{#if location}<span class="text-text-secondary">{location}</span> · {/if}{yearLabel(pr.date)}{#if recent}<span style="color: {C.green}"> NEW</span>{/if}</button>
						{:else}
							<span class="num text-[10px] text-text-dim truncate min-w-0">{#if location}<span class="text-text-secondary">{location}</span> · {/if}{yearLabel(pr.date)}{#if recent}<span style="color: {C.green}"> NEW</span>{/if}</span>
						{/if}
					{/if}
				</div>

			{#if pr}
					<div class="flex items-center gap-2">
						<Trophy size={16} weight="bold" class="text-text-dim shrink-0" />
						<span class="num text-lg font-bold text-text">{pr.formatted_value}</span>
						<span class="num text-sm text-text-secondary ml-auto">{(pr.pace_min_km ?? pace(pr.value, dist.km)).replace(' /km', '/km')}</span>
					</div>
				{:else}
					<div class="flex items-center gap-2 text-sm text-text-dim"><Trophy size={16} weight="bold" class="shrink-0" /> no PR</div>
				{/if}

				<div class="mt-2 flex items-center gap-2 border-t border-card-border/50 pt-2">
					<TrendUp size={16} weight="bold" class="text-text-dim shrink-0" />
					<span class="num text-lg font-bold text-text-dim">{dist.predTimeStr}</span>
					<span class="num text-sm text-text-dim ml-auto">{dist.predPace}/km</span>
				</div>
			</div>
		{/each}
	</div>
</div>
