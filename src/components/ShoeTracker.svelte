<script lang="ts">
	import type { GearItem } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import Sneaker from 'phosphor-svelte/lib/Sneaker';
	import Tip from './Tip.svelte';

	interface Props {
		gear: GearItem[];
	}

	let { gear }: Props = $props();

	const shoes = $derived(gear.filter(g => g.gear_type_name === 'Shoes' && g.gear_status_name !== 'retired'));

	function km(meters: number): number {
		return Math.round(meters / 1000);
	}

	function pct(shoe: GearItem): number {
		if (shoe.maximum_meters <= 0) return 0;
		return Math.min((shoe.distance_meters / shoe.maximum_meters) * 100, 100);
	}

	function healthColor(shoe: GearItem): string {
		const p = pct(shoe);
		if (p < 60) return C.green;
		if (p < 85) return C.amber;
		return C.red;
	}

	function healthLabel(shoe: GearItem): string {
		const p = pct(shoe);
		if (p < 60) return 'Good';
		if (p < 85) return 'Rotate';
		return 'Replace';
	}

	function since(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
	}
</script>

{#if shoes.length > 0}
<div>
	<h2 class="mt-4 mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Sneaker size={14} weight="bold" /> Shoes</h2>
	<div class="grid gap-4 sm:grid-cols-2">
		{#each shoes as shoe}
			{@const color = healthColor(shoe)}
			{@const p = pct(shoe)}
			<Tip text={`${shoe.brand}\n${km(shoe.distance_meters)} / ${km(shoe.maximum_meters)} km (${Math.round(p)}%)\n${shoe.activities} runs${shoe.date_begin ? ` · since ${since(shoe.date_begin)}` : ''}`}>
				<div class="rounded-lg bg-card px-3 md:px-4 py-3">
					<div class="flex items-baseline justify-between gap-2">
						<span class="text-sm font-medium text-text truncate">{shoe.display_name}</span>
						<span class="num text-xs shrink-0" style="color: {color}">
							<span class="font-bold">{km(shoe.distance_meters)}</span><span class="text-text-dim">/{km(shoe.maximum_meters)}km</span>
						</span>
					</div>
					<div class="mt-2 h-1.5 rounded-full bg-card-border overflow-hidden">
						<div class="h-full rounded-full transition-all" style="width: {p}%; background: {color};"></div>
					</div>
					<div class="mt-1.5 flex items-center justify-between text-[10px]">
						<span class="num text-text-secondary">{shoe.activities} runs{#if shoe.date_begin}<span class="text-text-dim">&nbsp;·&nbsp;{since(shoe.date_begin)}</span>{/if}</span>
						<span class="num font-medium" style="color: {color}">{healthLabel(shoe)}</span>
					</div>
				</div>
			</Tip>
		{/each}
	</div>
</div>
{/if}
