<script lang="ts">
	import type { Activity, ActivitySplit } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Metronome from 'phosphor-svelte/lib/Metronome';

	interface Props {
		activities: Activity[];
		recentSplits: Record<number, ActivitySplit[]>;
	}

	let { activities, recentSplits }: Props = $props();

	const pacingAnalysis = $derived(() => {
		const results: { name: string; fadePercent: number; assessment: string }[] = [];
		const activityMap = new Map(activities.map(a => [a.activity_id, a]));
		for (const [idStr, splits] of Object.entries(recentSplits)) {
			const id = Number(idStr);
			const activity = activityMap.get(id);
			if (!activity || splits.length < 3) continue;
			const core = splits.slice(1, -1);
			if (core.length < 2) continue;
			const firstHalf = core.slice(0, Math.ceil(core.length / 2));
			const secondHalf = core.slice(Math.ceil(core.length / 2));
			const avgFirst = firstHalf.reduce((s, sp) => s + sp.duration_seconds / (sp.distance_meters / 1000), 0) / firstHalf.length;
			const avgSecond = secondHalf.reduce((s, sp) => s + sp.duration_seconds / (sp.distance_meters / 1000), 0) / secondHalf.length;
			const fade = ((avgSecond - avgFirst) / avgFirst) * 100;
			let assessment = 'Even';
			if (fade > 5) assessment = 'Fading';
			else if (fade > 2) assessment = 'Slight fade';
			else if (fade < -2) assessment = 'Negative split';
			results.push({ name: activity.activity_name, fadePercent: fade, assessment });
		}
		return results;
	});
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text={"Pace fade: second half vs first half of each run.\n\nNegative = you sped up (negative split)\n0 ± 2% = even pacing (ideal)\n> 5% = fading (went out too hard)\n\nExcludes first and last km (warm-up/cool-down)."}>
		<h2 class="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Metronome size={14} weight="bold" /> Pacing Consistency</h2>
	</Tip>
	{#if pacingAnalysis().length === 0}
		<p class="text-xs text-text-dim">No split data available yet.</p>
	{:else}
		<div class="space-y-2">
			{#each pacingAnalysis() as run}
				{@const fadeColor = run.fadePercent > 5 ? C.red : run.fadePercent > 2 ? C.amber : run.fadePercent < -2 ? C.green : C.textSecondary}
				<div class="flex items-center justify-between gap-2">
					<span class="text-xs text-text-secondary truncate max-w-[140px]">{run.name}</span>
					<div class="flex items-center gap-1.5">
						<span class="num text-xs font-medium" style="color: {fadeColor}">
							{run.fadePercent > 0 ? '+' : ''}{run.fadePercent.toFixed(1)}%
						</span>
						<span class="text-[10px] text-text-dim">{run.assessment}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
