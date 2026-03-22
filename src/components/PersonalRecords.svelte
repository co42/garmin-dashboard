<script lang="ts">
	import type { PersonalRecord } from '$lib/types.js';
	import { formatTime, formatDate, formatDistance } from '$lib/format.js';
	import Tip from './Tip.svelte';

	interface Props {
		records: PersonalRecord[];
	}

	let { records }: Props = $props();

	const RECORD_TYPES: Record<number, { label: string; unit: 'time' | 'distance' }> = {
		1: { label: '1K', unit: 'time' },
		2: { label: '1 Mile', unit: 'time' },
		3: { label: '5K', unit: 'time' },
		4: { label: '10K', unit: 'time' },
		5: { label: 'Half Marathon', unit: 'time' },
		6: { label: 'Marathon', unit: 'time' },
		7: { label: 'Longest Run', unit: 'distance' },
	};

	const displayRecords = $derived(
		records.filter(r => RECORD_TYPES[r.type_id]).sort((a, b) => a.type_id - b.type_id)
	);

	function formatValue(record: PersonalRecord): string {
		const type = RECORD_TYPES[record.type_id];
		if (type.unit === 'time') return formatTime(record.value);
		return `${formatDistance(record.value)} km`;
	}

	function isRecent(date: string): boolean {
		return Date.now() - new Date(date).getTime() < 30 * 86400000;
	}
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text="Your all-time best performances. Records set in the last 30 days are highlighted. These only update when you beat a previous best during an activity.">
		<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">Personal Records</h2>
	</Tip>

	{#if displayRecords.length === 0}
		<p class="text-xs text-text-dim">No records available.</p>
	{:else}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
			{#each displayRecords as record}
				{@const recent = isRecent(record.date)}
				<div class="rounded bg-card-border/50 px-3 py-2" style={recent ? 'box-shadow: 0 0 0 1px rgba(34,197,94,0.3);' : ''}>
					<span class="text-[10px] font-semibold uppercase text-text-dim">{RECORD_TYPES[record.type_id].label}</span>
					<p class="text-sm font-bold text-text">{formatValue(record)}</p>
					<p class="text-[10px] text-text-secondary">
						{formatDate(record.date)}
						{#if recent}<span style="color: #22c55e"> NEW</span>{/if}
					</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
