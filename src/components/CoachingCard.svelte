<script lang="ts">
	import type { Advice } from '$lib/advice.js';
	import { getIntensityColor } from '$lib/advice.js';

	interface Props {
		advice: Advice;
	}

	let { advice }: Props = $props();

	const color = $derived(getIntensityColor(advice.intensity));
</script>

<div
	class="rounded-lg bg-card p-4"
	style="border-left: 3px solid {color};"
>
	<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">Next Run</h2>

	<div class="mb-2 flex items-center gap-2">
		<span
			class="rounded px-2 py-0.5 text-xs font-semibold uppercase"
			style="background: {color}20; color: {color};"
		>
			{advice.intensity}
		</span>
		<span class="text-base font-bold text-text">{advice.runType}</span>
	</div>

	<p class="mb-3 text-sm text-text-secondary">{advice.description}</p>

	{#if advice.distanceKm || advice.paceGuidance}
		<div class="mb-3 flex gap-4">
			{#if advice.distanceKm}
				<div>
					<span class="text-[10px] uppercase text-text-dim">Distance</span>
					<p class="text-sm font-medium text-text">{advice.distanceKm} km</p>
				</div>
			{/if}
			{#if advice.paceGuidance}
				<div>
					<span class="text-[10px] uppercase text-text-dim">Pace</span>
					<p class="text-sm font-medium text-text">{advice.paceGuidance}</p>
				</div>
			{/if}
		</div>
	{/if}

	<p class="text-xs leading-relaxed text-text-dim">{advice.rationale}</p>
</div>
