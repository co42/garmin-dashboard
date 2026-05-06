<script lang="ts">
	import type { Workout, WorkoutStep } from '$lib/types.js';
	import { stepsEstimates, fmtDist, fmtDuration } from '$lib/workout-steps.js';
	import { tick } from 'svelte';
	import X from 'phosphor-svelte/lib/X';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Trash from 'phosphor-svelte/lib/Trash';
	import ArrowUp from 'phosphor-svelte/lib/ArrowUp';
	import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
	import Repeat from 'phosphor-svelte/lib/Repeat';

	// ── Internal editor types ──────────────────────────────────────────────
	// We work with a slightly trimmer shape than `WorkoutStep` so the UI can
	// avoid juggling nullable target_value pairs by hand. Conversion to/from
	// the storage shape happens at load/save.

	type StepKind = 'warmup' | 'cooldown' | 'interval' | 'recovery' | 'rest';
	type EndKind = 'lap.button' | 'time' | 'distance';
	type Target =
		| { kind: 'none' }
		| { kind: 'pace'; fast_mps: number; slow_mps: number }
		| { kind: 'hr'; lo: number; hi: number };

	type ExecStep = {
		uid: number;
		type: 'exec';
		step_type: StepKind;
		end_kind: EndKind;
		end_value: number;
		target: Target;
		description: string;
	};
	type RepeatStep = {
		uid: number;
		type: 'repeat';
		iterations: number;
		steps: EditStep[];
	};
	type EditStep = ExecStep | RepeatStep;

	// ── Props ─────────────────────────────────────────────────────────────

	interface Prefill {
		workout_name: string;
		description: string | null;
		sport_type: string | null;
		steps: WorkoutStep[];
	}

	interface Props {
		// Existing workout to edit. When set, save goes to PUT /api/workouts/[id].
		workout?: Workout | null;
		// Initial values for a NEW workout (e.g. copied from a coach workout).
		// Save goes to POST /api/workouts. Ignored when `workout` is set.
		prefill?: Prefill | null;
		open: boolean;
		onClose: () => void;
		onSaved: (workoutId?: number) => void;
	}

	let { workout = null, prefill = null, open, onClose, onSaved }: Props = $props();

	// ── State ─────────────────────────────────────────────────────────────

	let name = $state('');
	let description = $state('');
	let steps = $state<EditStep[]>([]);
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);

	let nextUid = 0;
	const uid = () => ++nextUid;

	// Reset whenever the modal opens (or the bound workout changes)
	$effect(() => {
		if (!open) return;
		const source = workout ?? prefill;
		name = source?.workout_name ?? '';
		description = source?.description ?? '';
		steps = source ? source.steps.map(toEdit) : [defaultStep('warmup')];
		errorMsg = null;
	});

	function toEdit(s: WorkoutStep): EditStep {
		if (s.type === 'RepeatGroupDTO') {
			return {
				uid: uid(),
				type: 'repeat',
				iterations: s.number_of_iterations ?? 1,
				steps: (s.steps ?? []).map(toEdit),
			};
		}
		return {
			uid: uid(),
			type: 'exec',
			step_type: (s.step_type as StepKind) || 'interval',
			end_kind: (s.end_condition as EndKind) || 'lap.button',
			end_value: s.end_condition_value ?? 0,
			target: parseTarget(s),
			description: s.description ?? '',
		};
	}

	function parseTarget(s: WorkoutStep): Target {
		if (s.target_type === 'pace.zone' && s.target_value_one != null && s.target_value_two != null) {
			const [fast, slow] = s.target_value_one > s.target_value_two
				? [s.target_value_one, s.target_value_two]
				: [s.target_value_two, s.target_value_one];
			return { kind: 'pace', fast_mps: fast, slow_mps: slow };
		}
		if (s.target_type === 'heart.rate.zone' && s.target_value_one != null && s.target_value_two != null) {
			const [lo, hi] = s.target_value_one < s.target_value_two
				? [s.target_value_one, s.target_value_two]
				: [s.target_value_two, s.target_value_one];
			return { kind: 'hr', lo: Math.round(lo), hi: Math.round(hi) };
		}
		return { kind: 'none' };
	}

	function toStorage(s: EditStep): WorkoutStep {
		if (s.type === 'repeat') {
			return {
				type: 'RepeatGroupDTO',
				step_type: '',
				end_condition: 'iterations',
				end_condition_value: s.iterations,
				target_type: null,
				target_value_one: null,
				target_value_two: null,
				description: null,
				exercise_name: null,
				category: null,
				number_of_iterations: s.iterations,
				steps: s.steps.map(toStorage),
			};
		}
		const t = s.target;
		const target_type = t.kind === 'pace' ? 'pace.zone' : t.kind === 'hr' ? 'heart.rate.zone' : null;
		const target_value_one = t.kind === 'pace' ? t.fast_mps : t.kind === 'hr' ? t.lo : null;
		const target_value_two = t.kind === 'pace' ? t.slow_mps : t.kind === 'hr' ? t.hi : null;
		return {
			type: 'ExecutableStepDTO',
			step_type: s.step_type,
			end_condition: s.end_kind,
			end_condition_value: s.end_kind === 'lap.button' ? 0 : s.end_value,
			target_type,
			target_value_one,
			target_value_two,
			description: s.description.trim() || null,
			exercise_name: null,
			category: null,
			number_of_iterations: null,
			steps: null,
		};
	}

	function defaultStep(kind: StepKind = 'interval'): ExecStep {
		return {
			uid: uid(),
			type: 'exec',
			step_type: kind,
			end_kind: kind === 'rest' || kind === 'recovery' ? 'time' : 'distance',
			end_value: kind === 'rest' || kind === 'recovery' ? 60 : 1000,
			target: { kind: 'none' },
			description: '',
		};
	}
	function defaultRepeat(): RepeatStep {
		return { uid: uid(), type: 'repeat', iterations: 4, steps: [defaultStep('interval'), defaultStep('recovery')] };
	}

	// ── Step list operations (recurse into repeat groups via path) ────────
	// `path` is the index chain from the root, e.g. [2, 0] = first child of
	// the root's third step. Empty path = root list.

	function getList(path: number[]): EditStep[] {
		let cur: EditStep[] = steps;
		for (const i of path) {
			const node = cur[i];
			if (node.type !== 'repeat') throw new Error('path into non-repeat');
			cur = node.steps;
		}
		return cur;
	}

	// Direct in-place mutation — Svelte 5 $state proxies detect array
	// push/splice and re-render. Earlier we structuredClone'd-then-replaced;
	// that severs the reactive link for nested arrays in some cases, which
	// is why "+ step" silently no-op'd inside the edit-existing flow.

	function addAt(path: number[], step: EditStep) {
		getList(path).push(step);
	}

	function removeAt(path: number[], index: number) {
		getList(path).splice(index, 1);
	}

	function moveAt(path: number[], index: number, dir: -1 | 1) {
		const list = getList(path);
		const j = index + dir;
		if (j < 0 || j >= list.length) return;
		[list[index], list[j]] = [list[j], list[index]];
	}

	// ── Pace conversion (min:sec/km ↔ m/s) ────────────────────────────────

	function paceToStr(mps: number): string {
		if (!mps || mps <= 0) return '';
		const secsPerKm = 1000 / mps;
		const m = Math.floor(secsPerKm / 60);
		const sec = Math.round(secsPerKm % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}
	function strToPace(str: string): number | null {
		const m = str.trim().match(/^(\d+):(\d{1,2})$/);
		if (!m) return null;
		const mins = Number(m[1]);
		const secs = Number(m[2]);
		if (secs >= 60) return null;
		const total = mins * 60 + secs;
		if (total <= 0) return null;
		return 1000 / total;
	}

	// ── Step duration (M:SS) ──────────────────────────────────────────────

	function secsToMinSec(s: number): string {
		if (!s || s <= 0) return '';
		const m = Math.floor(s / 60);
		const sec = Math.round(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}
	function minSecToSecs(str: string): number | null {
		const m = str.trim().match(/^(\d+):(\d{1,2})$/);
		if (!m) return null;
		const mins = Number(m[1]);
		const secs = Number(m[2]);
		if (secs >= 60) return null;
		const total = mins * 60 + secs;
		if (total <= 0) return null;
		return total;
	}

	// ── Estimates (live total dist/time/step count) ───────────────────────

	const storageSteps = $derived(steps.map(toStorage));
	const est = $derived(stepsEstimates(storageSteps));

	// ── Validation ─────────────────────────────────────────────────────────

	const validation = $derived.by(() => {
		const errs: string[] = [];
		if (name.trim() === '') errs.push('Name is required.');
		if (steps.length === 0) errs.push('At least one step is required.');
		walk(steps);
		function walk(list: EditStep[]) {
			for (const s of list) {
				if (s.type === 'repeat') {
					if (!Number.isInteger(s.iterations) || s.iterations < 1) errs.push('Repeat iterations must be ≥ 1.');
					if (s.steps.length === 0) errs.push('Repeat groups must contain at least one step.');
					walk(s.steps);
					continue;
				}
				if (s.end_kind !== 'lap.button' && (!Number.isFinite(s.end_value) || s.end_value <= 0)) {
					errs.push('Step duration/distance must be > 0.');
				}
				if (s.target.kind === 'pace') {
					if (!(s.target.fast_mps > s.target.slow_mps)) errs.push('Pace target: faster pace must be lower min/km than slower.');
				}
				if (s.target.kind === 'hr') {
					if (!Number.isInteger(s.target.lo) || !Number.isInteger(s.target.hi)) errs.push('HR values must be integers.');
					if (s.target.lo < 50 || s.target.hi > 230) errs.push('HR values must be between 50 and 230.');
					if (s.target.lo >= s.target.hi) errs.push('HR target: low must be less than high.');
				}
			}
		}
		return [...new Set(errs)];
	});
	const isValid = $derived(validation.length === 0);

	// ── Save / Cancel ─────────────────────────────────────────────────────

	async function save() {
		if (!isValid || saving) return;
		saving = true;
		errorMsg = null;
		const body = {
			workout_name: name.trim(),
			description: description.trim() || null,
			sport_type: 'running',
			steps: storageSteps,
		};
		try {
			const url = workout ? `/api/workouts/${workout.workout_id}` : '/api/workouts';
			const method = workout ? 'PUT' : 'POST';
			const res = await fetch(url, {
				method,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!res.ok) throw new Error(await res.text());
			onSaved(workout?.workout_id);
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

	// Focus the name field on open.
	let nameInput = $state<HTMLInputElement | undefined>(undefined);
	$effect(() => {
		if (open) tick().then(() => nameInput?.focus());
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
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
		aria-label="Workout editor"
	>
		<div class="pointer-events-auto w-full max-w-3xl max-h-[90vh] flex flex-col rounded-lg border border-card-border bg-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-card-border px-4 py-3">
				<h2 class="text-sm font-semibold tracking-wider uppercase text-text-secondary">
					{workout ? 'Edit Workout' : 'New Workout'}
				</h2>
				<button
					type="button"
					class="cursor-pointer text-text-dim hover:text-text-secondary"
					onclick={close}
					aria-label="Close"
				><X size={16} weight="bold" /></button>
			</div>

			<!-- Body (scrollable) -->
			<div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
				<!-- Name + description -->
				<div class="space-y-2">
					<input
						bind:this={nameInput}
						class="w-full bg-card border border-card-border rounded-md px-3 py-2 text-sm text-text placeholder:text-text-dim outline-none focus:border-blue-500/60"
						placeholder="Workout name"
						bind:value={name}
					/>
					<textarea
						class="w-full bg-card border border-card-border rounded-md px-3 py-2 text-xs text-text-secondary placeholder:text-text-dim outline-none focus:border-blue-500/60 resize-none"
						rows={2}
						placeholder="Description (optional)"
						bind:value={description}
					></textarea>
				</div>

				<!-- Steps -->
				<div>
					<div class="text-[10px] font-medium uppercase tracking-wider text-text-dim mb-2">Steps</div>
					<div class="space-y-2">
						{@render stepList(steps, [])}
					</div>
					<div class="flex gap-2 mt-3">
						<button
							type="button"
							class="cursor-pointer inline-flex items-center gap-1 rounded-md border border-card-border bg-card px-2.5 py-1 text-xs text-text-secondary hover:text-text hover:border-text-dim transition-colors"
							onclick={() => addAt([], defaultStep('interval'))}
						><Plus size={12} weight="bold" /> Step</button>
						<button
							type="button"
							class="cursor-pointer inline-flex items-center gap-1 rounded-md border border-card-border bg-card px-2.5 py-1 text-xs text-text-secondary hover:text-text hover:border-text-dim transition-colors"
							onclick={() => addAt([], defaultRepeat())}
						><Repeat size={12} weight="bold" /> Repeat group</button>
					</div>
				</div>

				<!-- Validation errors -->
				{#if validation.length > 0}
					<div class="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
						<ul class="list-disc pl-4 space-y-0.5">
							{#each validation as err}<li>{err}</li>{/each}
						</ul>
					</div>
				{/if}

				{#if errorMsg}
					<div class="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
						{errorMsg}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between border-t border-card-border px-4 py-3 text-xs">
				<div class="text-text-dim num">
					{est.count} step{est.count === 1 ? '' : 's'}
					{#if est.dist > 0} · {fmtDist(est.dist)}{/if}
					{#if est.time > 0} · {fmtDuration(est.time)}{/if}
				</div>
				<div class="flex gap-2">
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
					>{saving ? 'Saving…' : workout ? 'Save' : 'Create'}</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#snippet stepList(list: EditStep[], path: number[])}
	{#each list as step, i (step.uid)}
		{@render stepCard(step, i, list.length, path)}
	{/each}
{/snippet}

{#snippet stepCard(step: EditStep, index: number, total: number, path: number[])}
	<div class="rounded-md border border-card-border bg-card">
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-2">
			<!-- Reorder buttons -->
			<div class="flex flex-col gap-0.5">
				<button
					type="button"
					class="cursor-pointer text-text-dim hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
					onclick={() => moveAt(path, index, -1)}
					disabled={index === 0}
					aria-label="Move up"
				><ArrowUp size={11} weight="bold" /></button>
				<button
					type="button"
					class="cursor-pointer text-text-dim hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
					onclick={() => moveAt(path, index, 1)}
					disabled={index === total - 1}
					aria-label="Move down"
				><ArrowDown size={11} weight="bold" /></button>
			</div>

			{#if step.type === 'repeat'}
				<div class="flex flex-1 flex-wrap items-center gap-2 text-xs">
					<span class="inline-flex items-center gap-1 text-text-secondary"><Repeat size={12} weight="bold" /> Repeat</span>
					<input
						type="number"
						min="1"
						class="no-spinner w-16 bg-bg border border-card-border rounded px-2 py-0.5 text-text num outline-none focus:border-blue-500/60"
						bind:value={step.iterations}
					/>
					<span class="text-text-dim">×</span>
				</div>
			{:else}
				{@render execControls(step)}
			{/if}

			<!-- Remove -->
			<button
				type="button"
				class="cursor-pointer text-text-dim hover:text-status-red transition-colors"
				onclick={() => removeAt(path, index)}
				aria-label="Remove step"
			><Trash size={12} weight="bold" /></button>
		</div>

		{#if step.type === 'repeat'}
			<div class="border-t border-card-border/60 bg-card-border/5 p-2 space-y-2">
				{@render stepList(step.steps, [...path, index])}
				<div class="flex gap-2">
					<button
						type="button"
						class="cursor-pointer inline-flex items-center gap-1 rounded-md border border-card-border bg-card px-2 py-1 text-[10px] text-text-secondary hover:text-text hover:border-text-dim transition-colors"
						onclick={() => addAt([...path, index], defaultStep('interval'))}
					><Plus size={10} weight="bold" /> Step</button>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet execControls(step: ExecStep)}
	<!-- Step type -->
	<select
		class="bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text-secondary outline-none focus:border-blue-500/60"
		bind:value={step.step_type}
	>
		<option value="warmup">Warm Up</option>
		<option value="interval">Run</option>
		<option value="recovery">Recovery</option>
		<option value="rest">Rest</option>
		<option value="cooldown">Cool Down</option>
	</select>

	<!-- End condition -->
	<select
		class="bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text-secondary outline-none focus:border-blue-500/60"
		bind:value={step.end_kind}
	>
		<option value="lap.button">Lap</option>
		<option value="time">Time</option>
		<option value="distance">Distance</option>
	</select>

	{#if step.end_kind === 'time'}
		<input
			type="text"
			placeholder="0:30"
			class="w-20 bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text num outline-none focus:border-blue-500/60"
			value={secsToMinSec(step.end_value)}
			oninput={(e) => {
				const v = minSecToSecs((e.currentTarget as HTMLInputElement).value);
				if (v != null) step.end_value = v;
			}}
		/>
	{:else if step.end_kind === 'distance'}
		<input
			type="number"
			min="1"
			step="50"
			class="no-spinner w-24 bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text num outline-none focus:border-blue-500/60"
			bind:value={step.end_value}
		/>
		<span class="text-[10px] text-text-dim">m</span>
	{/if}

	<!-- Target -->
	<select
		class="bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text-secondary outline-none focus:border-blue-500/60"
		value={step.target.kind}
		onchange={(e) => {
			const v = (e.currentTarget as HTMLSelectElement).value as Target['kind'];
			step.target =
				v === 'pace' ? { kind: 'pace', fast_mps: 1000 / 300, slow_mps: 1000 / 360 }
				: v === 'hr' ? { kind: 'hr', lo: 130, hi: 150 }
				: { kind: 'none' };
		}}
	>
		<option value="none">No target</option>
		<option value="pace">Pace</option>
		<option value="hr">HR</option>
	</select>

	{#if step.target.kind === 'pace'}
		{@render paceInputs(step.target)}
	{:else if step.target.kind === 'hr'}
		{@render hrInputs(step.target)}
	{/if}

	<input
		type="text"
		placeholder="note"
		class="flex-1 min-w-[8ch] bg-bg border border-card-border rounded px-2 py-0.5 text-[11px] text-text-dim placeholder:text-text-dim outline-none focus:border-blue-500/60"
		bind:value={step.description}
	/>
{/snippet}

{#snippet paceInputs(t: Target & { kind: 'pace' })}
	<input
		type="text"
		placeholder="5:00"
		class="w-16 bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text num outline-none focus:border-blue-500/60"
		value={paceToStr(t.fast_mps)}
		oninput={(e) => {
			const v = strToPace((e.currentTarget as HTMLInputElement).value);
			if (v != null) t.fast_mps = v;
		}}
	/>
	<span class="text-[10px] text-text-dim">–</span>
	<input
		type="text"
		placeholder="5:30"
		class="w-16 bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text num outline-none focus:border-blue-500/60"
		value={paceToStr(t.slow_mps)}
		oninput={(e) => {
			const v = strToPace((e.currentTarget as HTMLInputElement).value);
			if (v != null) t.slow_mps = v;
		}}
	/>
	<span class="text-[10px] text-text-dim">/km</span>
{/snippet}

{#snippet hrInputs(t: Target & { kind: 'hr' })}
	<input
		type="number"
		min="50"
		max="230"
		class="no-spinner w-16 bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text num outline-none focus:border-blue-500/60"
		bind:value={t.lo}
	/>
	<span class="text-[10px] text-text-dim">–</span>
	<input
		type="number"
		min="50"
		max="230"
		class="no-spinner w-16 bg-bg border border-card-border rounded px-2 py-0.5 text-xs text-text num outline-none focus:border-blue-500/60"
		bind:value={t.hi}
	/>
	<span class="text-[10px] text-text-dim">bpm</span>
{/snippet}
