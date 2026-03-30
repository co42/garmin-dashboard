<script lang="ts">
	import type { PersonalRecord } from '$lib/types.js';
	import { formatDate } from '$lib/format.js';
	import { C } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Trophy from 'phosphor-svelte/lib/Trophy';

	interface Props {
		records: PersonalRecord[];
	}

	let { records }: Props = $props();

	const displayRecords = $derived(
		records.filter(r => r.sport === 'running')
	);

	function isRecent(date?: string): boolean {
		if (!date) return false;
		return Date.now() - new Date(date).getTime() < 30 * 86400000;
	}
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text="Your all-time best performances. Records set in the last 30 days are highlighted. These only update when you beat a previous best during an activity.">
		<h2 class="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Trophy size={14} weight="bold" /> Personal Records</h2>
	</Tip>

	{#if displayRecords.length === 0}
		<p class="text-xs text-text-dim">No records available.</p>
	{:else}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
			{#each displayRecords as record}
				{@const recent = isRecent(record.date)}
				<div class="rounded bg-card-border/50 px-3 py-2" style={recent ? 'box-shadow: 0 0 0 1px rgba(34,197,94,0.3);' : ''}>
					<span class="text-[10px] font-semibold uppercase text-text-dim">{record.record_type}</span>
					<p class="num text-sm font-bold text-text">{record.formatted_value}</p>
					{#if record.pace_min_km}
						<p class="num text-[10px] text-text-dim">{record.pace_min_km}</p>
					{/if}
					<p class="text-[10px] text-text-secondary">
						{record.date ? formatDate(record.date) : ''}
						{#if recent}<span style="color: {C.green}"> NEW</span>{/if}
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
