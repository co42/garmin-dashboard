<script lang="ts">
	import { onMount } from 'svelte';
	import { timeAgo } from '$lib/format.js';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Skull from 'phosphor-svelte/lib/Skull';

	interface Props {
		lastSyncedAt: string | null;
	}

	let { lastSyncedAt }: Props = $props();
	let syncing = $state(false);
	let result = $state<{ status: string; duration_ms: number; counts?: any } | null>(null);
	let menuOpen = $state(false);
	let containerEl = $state<HTMLDivElement>();

	async function sync(full = false) {
		menuOpen = false;
		syncing = true;
		result = null;
		try {
			const url = full ? '/api/sync?full=1' : '/api/sync';
			const res = await fetch(url, { method: 'POST' });
			result = await res.json();
			if (result?.status === 'ok') {
				setTimeout(() => window.location.reload(), 500);
			}
		} catch (err: any) {
			result = { status: 'error', duration_ms: 0 };
		} finally {
			syncing = false;
		}
	}

	function maybeSync() {
		if (syncing) return;
		if (!lastSyncedAt) { sync(); return; }
		const elapsed = Date.now() - new Date(lastSyncedAt).getTime();
		if (elapsed > 30 * 60 * 1000) sync();
	}

	function handleClickOutside(e: MouseEvent) {
		if (menuOpen && containerEl && !containerEl.contains(e.target as Node)) {
			menuOpen = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && menuOpen) { menuOpen = false; }
	}

	onMount(() => {
		maybeSync();
		const interval = setInterval(maybeSync, 5 * 60 * 1000);
		const onVisible = () => { if (document.visibilityState === 'visible') maybeSync(); };
		document.addEventListener('visibilitychange', onVisible);
		document.addEventListener('click', handleClickOutside, true);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisible);
			document.removeEventListener('click', handleClickOutside, true);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="flex items-center gap-2">
	<div class="relative" bind:this={containerEl}>
		<div class="flex">
			<button
				onclick={() => sync()}
				disabled={syncing}
				class="cursor-pointer rounded-l-md bg-card-border px-2.5 py-1.5 text-xs font-medium text-text transition hover:bg-hover disabled:opacity-50 inline-flex items-center gap-1.5"
			>
				<ArrowsClockwise size={12} weight="bold" class={syncing ? 'animate-spin' : ''} />
				{#if syncing}Syncing…{:else}Sync{/if}
			</button>
			<button
				class="cursor-pointer rounded-r-md bg-card-border px-1.5 py-1.5 text-text-dim transition hover:bg-hover hover:text-text-secondary border-l border-hover disabled:opacity-50"
				onclick={() => menuOpen = !menuOpen}
				disabled={syncing}
				aria-haspopup="true"
				aria-expanded={menuOpen}
			>
				<CaretDown size={10} weight="bold" class="transition-transform {menuOpen ? 'rotate-180' : ''}" />
			</button>
		</div>
		{#if menuOpen}
			<div
				class="absolute right-0 top-full mt-1 z-50 rounded-md bg-card border border-card-border shadow-lg shadow-black/40 py-1 min-w-[160px]"
				role="menu"
			>
				<button
					class="w-full text-left px-3 py-2 text-xs text-status-red hover:bg-card-border/50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
					role="menuitem"
					onclick={() => { if (confirm('Delete all data and re-sync from scratch?\nThis takes a few minutes.')) sync(true); }}
				>
					<Skull size={12} weight="bold" /> Full re-sync
				</button>
			</div>
		{/if}
	</div>

	{#if result?.status === 'ok'}
		<span class="num text-[10px] text-status-green">{(result.duration_ms / 1000).toFixed(1)}s</span>
	{:else if result?.status === 'error'}
		<span class="text-[10px] text-status-red">Failed</span>
	{/if}

	{#if lastSyncedAt}
		<span class="hidden md:inline num text-[10px] text-text-dim">{timeAgo(lastSyncedAt)}</span>
	{/if}
</div>
