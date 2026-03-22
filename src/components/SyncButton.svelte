<script lang="ts">
	import { timeAgo } from '$lib/format.js';

	interface Props {
		lastSyncedAt: string | null;
	}

	let { lastSyncedAt }: Props = $props();
	let syncing = $state(false);
	let result = $state<{ status: string; duration_ms: number; counts?: any } | null>(null);

	async function sync() {
		syncing = true;
		result = null;
		try {
			const res = await fetch('/api/sync', { method: 'POST' });
			result = await res.json();
			if (result?.status === 'ok') {
				// Reload to pick up new data
				setTimeout(() => window.location.reload(), 500);
			}
		} catch (err: any) {
			result = { status: 'error', duration_ms: 0 };
		} finally {
			syncing = false;
		}
	}
</script>

<div class="flex items-center gap-3">
	<button
		onclick={sync}
		disabled={syncing}
		class="rounded-md bg-card-border px-3 py-1.5 text-xs font-medium text-text transition hover:bg-[#2a2a3a] disabled:opacity-50"
	>
		{#if syncing}
			<span class="inline-flex items-center gap-1.5">
				<span class="h-3 w-3 animate-spin rounded-full border-2 border-text-dim border-t-text"></span>
				Syncing…
			</span>
		{:else}
			Sync Data
		{/if}
	</button>

	{#if result?.status === 'ok'}
		<span class="text-[10px] text-status-green">Done in {(result.duration_ms / 1000).toFixed(1)}s</span>
	{:else if result?.status === 'error'}
		<span class="text-[10px] text-status-red">Sync failed</span>
	{/if}

	{#if lastSyncedAt}
		<span class="text-[10px] text-text-dim">Last sync: {timeAgo(lastSyncedAt)}</span>
	{:else}
		<span class="text-[10px] text-text-dim">No data — click Sync to start</span>
	{/if}
</div>
