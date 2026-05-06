<script lang="ts">
	import type { Workout } from '$lib/types.js';
	import { fmtDist, fmtDuration, stepsEstimates } from '$lib/workout-steps.js';
	import { tick } from 'svelte';
	import X from 'phosphor-svelte/lib/X';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import Timer from 'phosphor-svelte/lib/Timer';

	interface Props {
		workouts: Workout[];
		date: string | null; // YYYY-MM-DD; null = closed
		busy?: boolean;
		onClose: () => void;
		onPick: (workoutId: number) => void;
	}

	let { workouts, date, busy = false, onClose, onPick }: Props = $props();

	let query = $state('');
	let searchInput = $state<HTMLInputElement | undefined>(undefined);

	$effect(() => {
		if (date) {
			query = '';
			tick().then(() => searchInput?.focus());
		}
	});

	const filtered = $derived(
		query.trim() === ''
			? workouts
			: workouts.filter(w => w.workout_name.toLowerCase().includes(query.trim().toLowerCase()))
	);

	function metrics(w: Workout): { distM: number | null; durS: number | null; isRunning: boolean } {
		const est = w.steps.length > 0 ? stepsEstimates(w.steps) : null;
		return {
			distM: w.estimated_distance_meters ?? (est && est.dist > 0 ? est.dist : null),
			durS: w.estimated_duration_seconds ?? (est && est.time > 0 ? est.time : null),
			isRunning: w.sport_type == null || w.sport_type === 'running',
		};
	}

	function fmtDateLabel(d: string): string {
		const dt = new Date(d + 'T12:00:00Z');
		const wk = dt.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
		const dm = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
		return `${wk} ${dm}`;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && date) onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if date}
	<button
		type="button"
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm cursor-default"
		aria-label="Close"
		onclick={onClose}
	></button>

	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 pointer-events-none"
		role="dialog"
		aria-modal="true"
		aria-label="Pick workout"
	>
		<div class="pointer-events-auto w-full max-w-md max-h-[80vh] flex flex-col rounded-lg border border-card-border bg-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-card-border px-4 py-3">
				<div class="text-sm font-semibold tracking-wider uppercase text-text-secondary">
					Schedule on <span class="text-text">{fmtDateLabel(date)}</span>
				</div>
				<button
					type="button"
					class="cursor-pointer text-text-dim hover:text-text-secondary"
					onclick={onClose}
					aria-label="Close"
				><X size={16} weight="bold" /></button>
			</div>

			<!-- Search -->
			<div class="border-b border-card-border px-3 py-2">
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Search workouts…"
					class="w-full bg-card border border-card-border rounded-md px-2.5 py-1 text-sm text-text placeholder:text-text-dim outline-none focus:border-blue-500/60"
					bind:value={query}
				/>
			</div>

			<!-- List -->
			<div class="flex-1 overflow-y-auto p-2 space-y-1">
				{#each filtered as w (w.workout_id)}
					{@const m = metrics(w)}
					<button
						type="button"
						class="cursor-pointer w-full text-left rounded-md border border-card-border bg-card hover:bg-card-border/30 transition-colors px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
						onclick={() => onPick(w.workout_id)}
						disabled={busy}
					>
						<div class="flex items-center gap-2">
							<span class="shrink-0 leading-[0] text-text-secondary">
								{#if m.isRunning}
									<PersonSimpleRun size={14} weight="bold" />
								{:else}
									<Barbell size={14} weight="bold" />
								{/if}
							</span>
							<span class="min-w-0 flex-1 truncate text-sm text-text">{w.workout_name}</span>
							<span class="shrink-0 flex items-center gap-2 text-[11px] text-text-dim num">
								{#if m.distM}<span class="num">{fmtDist(m.distM)}</span>{/if}
								{#if m.durS}<span class="num inline-flex items-center gap-0.5"><Timer size={10} weight="bold" />{fmtDuration(m.durS)}</span>{/if}
							</span>
						</div>
					</button>
				{:else}
					<div class="px-3 py-6 text-center text-xs text-text-dim">
						{workouts.length === 0 ? 'No workouts saved yet.' : 'No matches'}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
