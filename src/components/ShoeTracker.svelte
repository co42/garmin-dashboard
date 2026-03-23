<script lang="ts">
	import type { GearItem } from '$lib/types.js';

	interface Props {
		gear: GearItem[];
	}

	import { C } from '$lib/colors.js';
	import Sneaker from 'phosphor-svelte/lib/Sneaker';

	let { gear }: Props = $props();

	// Filter to active shoes only
	const shoes = $derived(gear.filter(g => g.active));

	function distanceKm(meters: number): string {
		return (meters / 1000).toFixed(0);
	}

	function healthColor(meters: number): string {
		const km = meters / 1000;
		if (km < 500) return C.green;
		if (km < 800) return C.amber;
		return C.red;
	}

	function healthPct(meters: number): number {
		return Math.min((meters / 1000) / 1000 * 100, 100); // Max at 1000km
	}

	function healthLabel(meters: number): string {
		const km = meters / 1000;
		if (km < 500) return 'Good';
		if (km < 800) return 'Consider rotating';
		return 'Replace soon';
	}
</script>

{#if shoes.length > 0}
	<div class="rounded-lg bg-card p-4">
		<h2 class="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Sneaker size={14} weight="bold" /> Shoes</h2>
		<div class="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
			{#each shoes as shoe}
				{@const color = healthColor(shoe.distance_meters)}
				<div class="rounded bg-card-border/30 px-3 py-2.5">
					<div class="flex items-baseline justify-between">
						<span class="text-sm font-medium text-text">{shoe.display_name}</span>
						<span class="num text-xs font-bold" style="color: {color}">{distanceKm(shoe.distance_meters)} km</span>
					</div>
					<div class="mt-2 h-1.5 rounded-full bg-card-border">
						<div class="h-full rounded-full" style="width: {healthPct(shoe.distance_meters)}%; background: {color};"></div>
					</div>
					<div class="mt-1 flex justify-between text-[10px] text-text-dim">
						<span class="num">{shoe.activities} runs</span>
						<span>{healthLabel(shoe.distance_meters)}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
