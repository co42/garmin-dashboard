<script lang="ts">
	import type { CalendarEntry, WorkoutStep, Activity, ActivityWeather, HrZone, Course } from '$lib/types.js';
	import { today, weekMonday, addDays, daysBetween } from '$lib/dates.js';
	import { computeMedianLoad, loadColor as computeLoadColor } from '$lib/colors.js';
	import { formatDistance } from '$lib/format.js';
	import ActivityRow from './ActivityRow.svelte';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import FlagCheckered from 'phosphor-svelte/lib/FlagCheckered';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import Path from 'phosphor-svelte/lib/Path';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';

	interface Props {
		calendar: CalendarEntry[];
		activities: Activity[];
		courses: Course[];
		hrZones: HrZone[];
		activityWeather: Record<number, ActivityWeather>;
		onNavigate?: (activityId: number) => void;
		onNavigateCourse?: (courseId: number) => void;
	}

	let { calendar, activities, courses, hrZones, activityWeather, onNavigate, onNavigateCourse }: Props = $props();

	// Course lookup by ID
	const courseMap = $derived(new Map(courses.map(c => [c.id, c])));
	const medianLoad = $derived(computeMedianLoad(activities.map(a => a.activity_training_load)));

	// ── Week boundaries (Monday-based) ──────────────────────────────────────

	const todayStr = today();
	const currentWeekStr = weekMonday(todayStr);
	let weekOffset = $state(0);
	const thisWeekStr = $derived(addDays(currentWeekStr, weekOffset * 7));
	const nextWeekStr = $derived(addDays(thisWeekStr, 7));
	const cutoffStr = $derived(addDays(thisWeekStr, 14));
	const isCurrentWeek = $derived(weekOffset === 0);

	function weekLabel(dateStr: string): string {
		const d = new Date(dateStr + 'T12:00:00Z');
		const end = new Date(addDays(dateStr, 6) + 'T12:00:00Z');
		const fmt = (dt: Date) => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
		return `${fmt(d)} – ${fmt(end)}`;
	}

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

	const sorted = $derived([...calendar].sort((a, b) => a.date.localeCompare(b.date)));

	// Completed workout IDs (from activity.workout_id)
	const completedWorkoutIds = $derived(new Set(
		activities.map(a => a.workout_id).filter((id): id is number => id != null)
	));

	function isWorkoutDone(entry: CalendarEntry): boolean {
		return entry.workout_id != null && completedWorkoutIds.has(entry.workout_id);
	}

	function weekRows(weekStart: string, weekEnd: string): Row[] {
		// Activities in this week range
		const activityRows: Row[] = activities
			.filter(a => {
				const d = a.start_time.slice(0, 10);
				return d >= weekStart && d < weekEnd;
			})
			.map((a): Row => ({
				kind: 'done',
				id: a.id,
				date: a.start_time.slice(0, 10),
				activity: a,
			}));

		// Scheduled workouts in this week range (future only, not done)
		const scheduledInWeek: Row[] = sorted
			.filter(c => c.item_type === 'workout' && c.date >= weekStart && c.date < weekEnd && c.date >= todayStr && !isWorkoutDone(c))
			.map((c): Row => ({ kind: 'scheduled', id: c.id, date: c.date, entry: c }));

		// Events in this week range
		const eventRows: Row[] = sorted
			.filter(c => c.item_type === 'event' && c.date >= weekStart && c.date < weekEnd)
			.map((c): Row => ({ kind: 'event', id: c.id, date: c.date, entry: c }));

		return [...activityRows, ...scheduledInWeek, ...eventRows].sort((a, b) => a.date.localeCompare(b.date));
	}

	const thisWeekRows = $derived(weekRows(thisWeekStr, nextWeekStr));
	const nextWeekRows = $derived(weekRows(nextWeekStr, cutoffStr));

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
		const diff = daysBetween(todayStr, dateStr);
		const jTag = diff === 0 ? 'J' : diff > 0 ? `J+${diff}` : `J${diff}`;
		// Display formatting uses local parse — safe here since it's only for labels
		const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
		const wk = d.toLocaleDateString('en-GB', { weekday: 'short' });
		const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
		return `${wk} ${dm} (${jTag})`;
	}

	function daysUntilDate(dateStr: string): number {
		return daysBetween(todayStr, dateStr);
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
	{#if row.kind === 'done'}
		<!-- Completed activity — shared row component (has its own padding) -->
		<div class="rounded-lg bg-card">
			<ActivityRow
				activity={row.activity}
				weather={activityWeather[row.activity.id] ?? null}
				{hrZones}
				loadColor={computeLoadColor(row.activity.activity_training_load, medianLoad)}
				context="calendar"
				{onNavigate}
			/>
		</div>
	{:else if row.kind === 'event'}
		{@const days = daysUntilDate(row.date)}
		{@const linkedCourse = row.entry.course_id ? courseMap.get(row.entry.course_id) ?? null : null}
		<div class="rounded-lg bg-card px-4 py-3">
			<div class="flex items-center gap-2.5">
				<span class="shrink-0 text-red-400"><FlagCheckered size={16} weight="fill" /></span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold text-text">{row.entry.title}</div>
					{#if linkedCourse}
						<button
							class="flex items-center gap-2 mt-0.5 text-xs text-text-dim hover:text-text-secondary transition-colors cursor-pointer"
							onclick={() => onNavigateCourse?.(linkedCourse.id)}
						>
							<span class="flex items-center gap-1"><Path size={11} weight="bold" /> {linkedCourse.name}</span>
							<span class="num">{formatDistance(linkedCourse.distance_meters)} km</span>
							<span class="num">D+ {Math.round(linkedCourse.elevation_gain_meters)}m</span>
						</button>
					{/if}
				</div>
				<span class="num rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
					in {days} days
				</span>
			</div>
		</div>
	{:else}
		<!-- Scheduled workout: collapsible -->
		{@const entry = row.entry}
		<div class="rounded-lg bg-card px-4 py-3">
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
		</div>
	{/if}
{/snippet}

<!-- ── Layout ────────────────────────────────────────────────────────────── -->

<div class="flex items-center justify-between mb-3">
	<div class="flex items-center gap-2">
		<button
			class="cursor-pointer rounded p-1 text-text-dim hover:text-text-secondary hover:bg-card-border/30 transition-colors"
			onclick={() => weekOffset--}
			aria-label="Previous weeks"
		><CaretLeft size={14} weight="bold" /></button>
		<span class="text-xs font-medium uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
			<CalendarBlank size={14} weight="bold" />
			{#if isCurrentWeek}Schedule{:else}{weekLabel(thisWeekStr)}{/if}
		</span>
		<button
			class="cursor-pointer rounded p-1 text-text-dim hover:text-text-secondary hover:bg-card-border/30 transition-colors"
			onclick={() => weekOffset++}
			aria-label="Next weeks"
		><CaretRight size={14} weight="bold" /></button>
		{#if !isCurrentWeek}
			<button
				class="cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium text-text-dim hover:text-text-secondary hover:bg-card-border/30 transition-colors"
				onclick={() => weekOffset = 0}
			>Today</button>
		{/if}
	</div>
</div>

<div class="grid gap-4 md:grid-cols-2">
	<div>
		<h3 class="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-dim">
			{#if isCurrentWeek}This Week{:else}{weekLabel(thisWeekStr)}{/if}
		</h3>
		{#if thisWeekRows.length > 0}
			<div class="grid gap-3">
				{#each thisWeekRows as row}
					{@render rowCard(row)}
				{/each}
			</div>
		{:else}
			<div class="rounded-lg bg-card px-4 py-3 text-xs text-text-dim">Nothing this week</div>
		{/if}
	</div>

	<div>
		<h3 class="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-dim">
			{#if isCurrentWeek}Next Week{:else}{weekLabel(nextWeekStr)}{/if}
		</h3>
		{#if nextWeekRows.length > 0}
			<div class="grid gap-3">
				{#each nextWeekRows as row}
					{@render rowCard(row)}
				{/each}
			</div>
		{:else}
			<div class="rounded-lg bg-card px-4 py-3 text-xs text-text-dim">Nothing this week</div>
		{/if}
	</div>
</div>
