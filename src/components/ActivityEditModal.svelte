<script lang="ts">
	import type { Activity } from '$lib/types.js';
	import { tick } from 'svelte';
	import X from 'phosphor-svelte/lib/X';

	interface Props {
		// Activity being edited. The modal opens lazy-loads the description from
		// Garmin (it's not part of the activity snapshot).
		activity: Activity | null;
		open: boolean;
		onClose: () => void;
		onSaved: () => void;
	}

	let { activity, open, onClose, onSaved }: Props = $props();

	let name = $state('');
	let description = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);

	// Reset + lazy-fetch description whenever the modal opens for a new activity.
	// The activity_id is captured locally so a slow GET that resolves after the
	// user picked a different activity doesn't clobber the visible state.
	$effect(() => {
		if (!open || !activity) return;
		const id = activity.activity_id;
		const initialName = activity.activity_name;
		name = initialName;
		description = '';
		errorMsg = null;
		loading = true;
		fetch(`/api/activity/${id}`)
			.then(r => r.ok ? r.json() : null)
			.then(data => {
				if (!activity || activity.activity_id !== id) return;
				description = data?.description ?? '';
			})
			.catch(() => { /* leave description empty on failure */ })
			.finally(() => { if (activity?.activity_id === id) loading = false; });
	});

	async function save() {
		if (saving || !activity) return;
		saving = true;
		errorMsg = null;
		try {
			const res = await fetch(`/api/activity/${activity.activity_id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), description }),
			});
			if (!res.ok) throw new Error(await res.text());
			onSaved();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	function close() {
		if (saving) return;
		onClose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	let nameInput = $state<HTMLInputElement | undefined>(undefined);
	$effect(() => {
		if (open) tick().then(() => nameInput?.focus());
	});

	const isValid = $derived(name.trim().length > 0);
</script>

<svelte:window onkeydown={onKeydown} />

{#if open && activity}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm cursor-default"
		aria-label="Close"
		onclick={close}
	></button>

	<!-- Modal -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 pointer-events-none"
		role="dialog"
		aria-modal="true"
		aria-label="Activity editor"
	>
		<div class="pointer-events-auto w-full max-w-lg max-h-[90vh] flex flex-col rounded-lg border border-card-border bg-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-card-border px-4 py-3">
				<h2 class="text-sm font-semibold tracking-wider uppercase text-text-secondary">Edit activity</h2>
				<button
					type="button"
					class="cursor-pointer text-text-dim hover:text-text-secondary"
					onclick={close}
					aria-label="Close"
				><X size={16} weight="bold" /></button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				<div>
					<label for="activity-edit-name" class="block text-[10px] font-medium uppercase tracking-wider text-text-dim mb-1">Title</label>
					<input
						id="activity-edit-name"
						bind:this={nameInput}
						class="w-full bg-card border border-card-border rounded-md px-3 py-2 text-sm text-text placeholder:text-text-dim outline-none focus:border-blue-500/60"
						placeholder="Activity title"
						bind:value={name}
					/>
				</div>
				<div>
					<label for="activity-edit-note" class="block text-[10px] font-medium uppercase tracking-wider text-text-dim mb-1">
						Note {#if loading}<span class="text-text-dim/60 normal-case">· loading…</span>{/if}
					</label>
					<textarea
						id="activity-edit-note"
						class="w-full bg-card border border-card-border rounded-md px-3 py-2 text-xs text-text-secondary placeholder:text-text-dim outline-none focus:border-blue-500/60 resize-none"
						rows={5}
						placeholder="Add a note (optional)"
						bind:value={description}
					></textarea>
				</div>

				{#if errorMsg}
					<div class="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
						{errorMsg}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-2 border-t border-card-border px-4 py-3 text-xs">
				<button
					type="button"
					class="cursor-pointer rounded-md px-3 py-1.5 text-text-secondary hover:text-text transition-colors"
					onclick={close}
					disabled={saving}
				>Cancel</button>
				<button
					type="button"
					class="cursor-pointer rounded-md bg-blue-500/20 px-3 py-1.5 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					onclick={save}
					disabled={!isValid || saving}
				>{saving ? 'Saving…' : 'Save'}</button>
			</div>
		</div>
	</div>
{/if}
