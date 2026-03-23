<script lang="ts">
	import type { CalendarEntry, WorkoutStep, Activity } from '$lib/types.js';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import FlagCheckered from 'phosphor-svelte/lib/FlagCheckered';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';

	interface Props {
		calendar: CalendarEntry[];
		activities: Activity[];
	}

	let { calendar, activities }: Props = $props();

	// ── Week boundaries (Monday-based) ──────────────────────────────────────

	function getMonday(d: Date): Date {
		const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
		const day = dt.getDay();
		dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
		return dt;
	}

	function toDateStr(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	const now = new Date();
	const todayStr = toDateStr(now);
	const thisMonday = getMonday(now);
	const nextMonday = new Date(thisMonday);
	nextMonday.setDate(nextMonday.getDate() + 7);
	const nextSunday = new Date(nextMonday);
	nextSunday.setDate(nextSunday.getDate() + 6);

	const thisWeekStr = toDateStr(thisMonday);
	const nextWeekStr = toDateStr(nextMonday);
	const cutoffStr = toDateStr(new Date(nextSunday.getTime() + 86400000));

	// ── Unified row type ────────────────────────────────────────────────────

	type Row = {
		kind: 'scheduled';
		id: number;
		date: string;
		entry: CalendarEntry;
	} | {
		kind: 'done';
		id: number;
		date: string;
		activity: Activity;
	} | {
		kind: 'event';
		id: number;
		date: string;
		entry: CalendarEntry;
	};

	// ── Build rows ──────────────────────────────────────────────────────────

	// Activities this week (Mon → today), keyed by date
	const thisWeekActivities = $derived(
		activities
			.filter(a => {
				const d = a.start_time.slice(0, 10);
				return d >= thisWeekStr && d <= todayStr;
			})
			.map((a): Row => ({
				kind: 'done',
				id: a.id,
				date: a.start_time.slice(0, 10),
				activity: a,
			}))
	);

	const sorted = $derived([...calendar].sort((a, b) => a.date.localeCompare(b.date)));
	const events = $derived(
		sorted.filter(c => c.item_type === 'event' && c.date >= thisWeekStr)
			.map((c): Row => ({ kind: 'event', id: c.id, date: c.date, entry: c }))
	);

	// Future scheduled workouts (exclude events, today onward)
	const scheduledRows = $derived(
		sorted
			.filter(c => c.item_type !== 'event' && c.date >= todayStr)
			.map((c): Row => ({ kind: 'scheduled', id: c.id, date: c.date, entry: c }))
	);

	// This week: done activities + today's and future scheduled (within this week)
	const thisWeekRows = $derived(
		[
			...thisWeekActivities,
			...scheduledRows.filter(r => r.date < nextWeekStr),
		].sort((a, b) => a.date.localeCompare(b.date))
	);

	// Next week: only scheduled
	const nextWeekRows = $derived(
		scheduledRows.filter(r => r.date >= nextWeekStr && r.date < cutoffStr)
	);

	// ── Expand/collapse ─────────────────────────────────────────────────────

	let expanded = $state(new Set<number>());

	function toggle(id: number) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	function isRunning(entry: CalendarEntry): boolean {
		return entry.sport_type === 'running';
	}

	function dateLabel(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86400000);
		const jTag = diff === 0 ? 'J' : diff > 0 ? `J+${diff}` : `J${diff}`;
		const wk = d.toLocaleDateString('en-GB', { weekday: 'short' });
		const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
		return `${wk} ${dm} (${jTag})`;
	}

	function daysUntil(dateStr: string): number {
		const d = new Date(dateStr + 'T00:00:00');
		return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
	}

	function fmtDist(m: number): string {
		return m >= 1000 ? `${m / 1000 % 1 === 0 ? m / 1000 : (m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
	}

	function fmtTime(s: number): string {
		const m = Math.floor(s / 60), sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	function fmtPace(s: number): string {
		const m = Math.floor(s / 60), sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}/km`;
	}

	function fmtExercise(name: string): string {
		return name.toLowerCase().replace(/_/g, ' ');
	}

	function fmtDuration(s: number): string {
		const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
		return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
	}

	function stepValues(s: WorkoutStep): string {
		const parts: string[] = [];
		if (s.end_condition === 'distance' && s.end_condition_value) parts.push(fmtDist(s.end_condition_value));
		else if (s.end_condition === 'time' && s.end_condition_value) parts.push(fmtTime(s.end_condition_value));
		else if (s.end_condition === 'iterations' && s.end_condition_value) parts.push(`${s.end_condition_value} reps`);
		else if (s.end_condition === 'lap.button') parts.push('lap');
		if (s.target_type === 'pace.zone' && s.target_value_one != null && s.target_value_two != null) {
			parts.push(`${fmtPace(s.target_value_one)}–${fmtPace(s.target_value_two)}`);
		} else if (s.target_type === 'heart.rate.zone' && s.target_value_one != null && s.target_value_two != null) {
			parts.push(s.target_value_one === s.target_value_two ? `${s.target_value_one} bpm` : `${s.target_value_one}–${s.target_value_two} bpm`);
		}
		return parts.join(' · ');
	}

	function stepExerciseName(s: WorkoutStep): string | null {
		return s.exercise_name ? fmtExercise(s.exercise_name) : null;
	}

	const STEP_LABELS: Record<string, string> = {
		warmup: 'Warm Up', cooldown: 'Cool Down', interval: 'Run',
		recovery: 'Recovery', rest: 'Rest',
	};
	function stepLabel(key: string): string { return STEP_LABELS[key] ?? key; }

	function activitySummary(a: Activity): string {
		const parts: string[] = [];
		if (a.distance_meters) parts.push(fmtDist(a.distance_meters));
		if (a.pace_min_km) parts.push(a.pace_min_km);
		if (a.duration_seconds) parts.push(fmtDuration(a.duration_seconds));
		if (a.avg_hr) parts.push(`${Math.round(a.avg_hr)} bpm`);
		if (a.elevation_gain && a.elevation_gain > 50) parts.push(`+${Math.round(a.elevation_gain)}m`);
		return parts.join(' · ');
	}
</script>

<!-- ── Snippets ─────────────────────────────────────────────────────────── -->

{#snippet runningSteps(steps: WorkoutStep[])}
	<div class="mt-1.5 ml-[26px] space-y-0.5">
		{#each steps as step}
			{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
				<div class="flex items-start gap-1.5 text-xs">
					<span class="num font-semibold text-text-dim">{step.number_of_iterations}×</span>
					<div class="space-y-0.5 flex-1">
						{#each step.steps ?? [] as sub}
							{@const subLine = stepValues(sub)}
							<div class="flex items-baseline gap-3">
								<span>
									<span class="font-medium text-text-secondary">{stepLabel(sub.step_type)}</span>
									{#if subLine}<span class="num text-text-dim"> · {subLine}</span>{/if}
								</span>
								{#if sub.description}
									<span class="text-text-dim text-[11px]">{sub.description}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else}
				{@const line = stepValues(step)}
				<div class="flex items-baseline gap-3 text-xs">
					<span>
						<span class="font-medium text-text-secondary">{stepLabel(step.step_type)}</span>
						{#if line}<span class="num text-text-dim"> · {line}</span>{/if}
					</span>
					{#if step.description}
						<span class="text-text-dim text-[11px]">{step.description}</span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet nonRunningSteps(steps: WorkoutStep[])}
	<div class="mt-1.5 ml-[26px] space-y-0.5">
		{#each steps as step}
			{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
				<div class="flex items-start gap-1.5 text-xs">
					<span class="num font-semibold text-text-dim">{step.number_of_iterations}×</span>
					<div class="space-y-0.5 flex-1">
						{#each step.steps ?? [] as sub}
							<div class="text-text-secondary">
													{#if stepExerciseName(sub)}{stepExerciseName(sub)}{/if}
													{#if stepValues(sub)}<span class="num"> · {stepValues(sub)}</span>{/if}
												</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="text-xs text-text-secondary">
								{#if stepExerciseName(step)}{stepExerciseName(step)}{/if}
								{#if stepValues(step)}<span class="num"> · {stepValues(step)}</span>{/if}
							</div>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet rowCard(row: Row)}
	<div class="rounded-lg bg-card px-4 py-3">
		{#if row.kind === 'event'}
			{@const days = daysUntil(row.date)}
			<div class="flex items-center gap-2.5">
				<span class="shrink-0 text-text-dim"><FlagCheckered size={16} weight="fill" /></span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold text-text">{row.entry.title}</div>
				</div>
				<span class="num rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
					in {days} days
				</span>
			</div>
		{:else if row.kind === 'done'}
			<!-- Completed activity -->
			<div class="flex items-center gap-2.5">
				<span class="shrink-0 text-green-500">
					{#if row.activity.activity_type === 'trail_running'}
						<Mountains size={16} />
					{:else}
						<PersonSimpleRun size={16} />
					{/if}
				</span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold text-text">{row.activity.name}</div>
					<div class="num text-xs text-text-dim">{activitySummary(row.activity)}</div>
				</div>
				<span class="shrink-0 text-xs text-text-dim font-mono tabular-nums">{dateLabel(row.date)}</span>
			</div>
		{:else}
			<!-- Scheduled workout: collapsible -->
			{@const entry = row.entry}
			<button
				class="flex w-full items-center gap-2.5 text-left cursor-pointer"
				onclick={() => toggle(entry.id)}
			>
				<span class="shrink-0 text-text-dim">
					{#if isRunning(entry)}
						<PersonSimpleRun size={16} />
					{:else}
						<Barbell size={16} />
					{/if}
				</span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold text-text">{entry.title}</div>
				</div>
				<span class="shrink-0 text-xs text-text-dim font-mono tabular-nums">{dateLabel(entry.date)}</span>
				{#if entry.steps.length > 0}
					<span class="shrink-0 text-text-dim">
						{#if expanded.has(entry.id)}
							<CaretDown size={12} />
						{:else}
							<CaretRight size={12} />
						{/if}
					</span>
				{/if}
			</button>
			{#if expanded.has(entry.id) && entry.steps.length > 0}
				{#if isRunning(entry)}
					{@render runningSteps(entry.steps)}
				{:else}
					{@render nonRunningSteps(entry.steps)}
				{/if}
			{/if}
		{/if}
	</div>
{/snippet}

<!-- ── Layout ────────────────────────────────────────────────────────────── -->

<div class="grid gap-4 md:grid-cols-2">
	<div>
		<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">This Week</h2>
		{#if thisWeekRows.length > 0}
			<div class="grid gap-3">
				{#each thisWeekRows as row}
					{@render rowCard(row)}
				{/each}
			</div>
		{:else}
			<div class="rounded-lg bg-card px-4 py-3 text-xs text-text-dim">No workouts scheduled</div>
		{/if}
	</div>

	<div>
		<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">Next Week</h2>
		{#if nextWeekRows.length > 0}
			<div class="grid gap-3">
				{#each nextWeekRows as row}
					{@render rowCard(row)}
				{/each}
			</div>
		{:else}
			<div class="rounded-lg bg-card px-4 py-3 text-xs text-text-dim">No workouts scheduled</div>
		{/if}
	</div>
</div>

{#if events.length > 0}
	<div class="grid gap-3">
		{#each events as row}
			{@render rowCard(row)}
		{/each}
	</div>
{/if}
