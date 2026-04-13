<script lang="ts">
	import type { CalendarEntry, WorkoutStep, Activity, ActivitySplit, ActivityWeather, HrZone, Course } from '$lib/types.js';
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
	import TrendUp from 'phosphor-svelte/lib/TrendUp';
	import PauseCircle from 'phosphor-svelte/lib/PauseCircle';
	import Robot from 'phosphor-svelte/lib/Robot';

	interface Props {
		calendar: CalendarEntry[];
		activities: Activity[];
		splits: Record<number, ActivitySplit[]>;
		courses: Course[];
		hrZones: HrZone[];
		activityWeather: Record<number, ActivityWeather>;
		onNavigate?: (activityId: number) => void;
		onNavigateCourse?: (courseId: number) => void;
	}

	let { calendar, activities, splits, courses, hrZones, activityWeather, onNavigate, onNavigateCourse }: Props = $props();

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
	} | {
		kind: 'rest';
		id: number;
		date: string;
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
			.filter(c => (c.item_type === 'workout' || c.item_type === 'fbtAdaptiveWorkout') && c.date >= weekStart && c.date < weekEnd && c.date >= todayStr && !isWorkoutDone(c))
			.map((c): Row => ({ kind: 'scheduled', id: c.id, date: c.date, entry: c }));

		// Events in this week range
		const eventRows: Row[] = sorted
			.filter(c => c.item_type === 'event' && c.date >= weekStart && c.date < weekEnd)
			.map((c): Row => ({ kind: 'event', id: c.id, date: c.date, entry: c }));

		const rows = [...activityRows, ...scheduledInWeek, ...eventRows];
		const filledDates = new Set(rows.map(r => r.date));

		// Fill in rest days for dates with nothing
		for (let i = 0; i < 7; i++) {
			const date = addDays(weekStart, i);
			if (date >= weekEnd) break;
			if (!filledDates.has(date)) {
				rows.push({ kind: 'rest', id: -i - 1, date });
			}
		}

		return rows.sort((a, b) => a.date.localeCompare(b.date));
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
		const d = new Date(dateStr.slice(0, 10) + 'T12:00:00Z');
		const wk = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
		const dm = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
		return `${wk} ${dm}`;
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

	function fmtPace(speedMs: number): string {
		const secs = Math.round(1000 / speedMs);
		const m = Math.floor(secs / 60), sec = secs % 60;
		return `${m}:${sec.toString().padStart(2, '0')}/km`;
	}

	function fmtExercise(name: string): string {
		return name.toLowerCase().replace(/_/g, ' ');
	}

	function fmtDuration(s: number): string {
		const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
		return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
	}

	function stepDuration(s: WorkoutStep): string {
		if (s.end_condition === 'distance' && s.end_condition_value) return fmtDist(s.end_condition_value);
		if (s.end_condition === 'time' && s.end_condition_value) return fmtTime(s.end_condition_value);
		if (s.end_condition === 'iterations' && s.end_condition_value) return `${s.end_condition_value} reps`;
		if (s.end_condition === 'lap.button') return 'lap';
		return '';
	}

	function stepTarget(s: WorkoutStep): string {
		if (s.target_type === 'pace.zone' && s.target_value_one != null && s.target_value_two != null) {
			return `${fmtPace(s.target_value_one)}–${fmtPace(s.target_value_two)}`;
		}
		if (s.target_type === 'heart.rate.zone' && s.target_value_one != null && s.target_value_two != null) {
			return s.target_value_one === s.target_value_two ? `${s.target_value_one} bpm` : `${s.target_value_one}–${s.target_value_two} bpm`;
		}
		return '';
	}

	function stepValues(s: WorkoutStep): string {
		return [stepDuration(s), stepTarget(s)].filter(Boolean).join(' · ');
	}

	function stepExerciseName(s: WorkoutStep): string | null {
		return s.exercise_name ? fmtExercise(s.exercise_name) : null;
	}

	const STEP_LABELS: Record<string, string> = {
		warmup: 'Warm Up', cooldown: 'Cool Down', interval: 'Run',
		recovery: 'Recovery', rest: 'Rest',
	};
	function stepLabel(key: string): string { return STEP_LABELS[key] ?? key; }

	function workoutSummary(steps: WorkoutStep[]): string {
		let totalDist = 0;
		let totalTime = 0;
		let stepCount = 0;
		function walk(list: WorkoutStep[], reps: number) {
			for (const s of list) {
				if (s.type === 'RepeatGroupDTO' && s.number_of_iterations && s.steps) {
					walk(s.steps, s.number_of_iterations);
				} else {
					stepCount++;
					if (s.end_condition === 'distance' && s.end_condition_value) totalDist += s.end_condition_value * reps;
					if (s.end_condition === 'time' && s.end_condition_value) totalTime += s.end_condition_value * reps;
				}
			}
		}
		walk(steps, 1);
		const parts: string[] = [];
		if (totalDist > 0) parts.push(fmtDist(totalDist));
		if (totalTime > 0) parts.push(fmtTime(totalTime));
		parts.push(`${stepCount} steps`);
		return parts.join(' · ');
	}

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

{#snippet runStep(step: WorkoutStep, indent: boolean)}
	<tr class="border-b border-card-border/20 hover:bg-card-border/10">
		<td class="py-1 pr-4 font-medium text-text-secondary whitespace-nowrap {indent ? 'pl-4' : ''}">{stepLabel(step.step_type)}</td>
		<td class="py-1 pr-4 num text-text whitespace-nowrap">{stepDuration(step)}</td>
		<td class="py-1 pr-4 num text-text-secondary whitespace-nowrap">{stepTarget(step)}</td>
		<td class="py-1 text-text-dim text-[11px]">{step.description ?? ''}</td>
	</tr>
{/snippet}

{#snippet runningSteps(steps: WorkoutStep[])}
	<table class="mt-2 ml-[26px] text-xs">
	<thead><tr class="text-text-dim border-b border-card-border">
		<th class="pb-1 pr-4 text-left font-medium">Step</th>
		<th class="pb-1 pr-4 text-left font-medium">Dist/Time</th>
		<th class="pb-1 pr-4 text-left font-medium">Target</th>
		<th class="pb-1 text-left font-medium">Note</th>
	</tr></thead>
	<tbody>
		{#each steps as step}
			{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
				<tr class="border-b border-card-border/20 bg-card-border/5">
					<td class="py-1 pr-4 num font-semibold text-text-secondary whitespace-nowrap" colspan="4">{step.number_of_iterations}×</td>
				</tr>
				{#each step.steps ?? [] as sub}
					{@render runStep(sub, true)}
				{/each}
			{:else}
				{@render runStep(step, false)}
			{/if}
		{/each}
	</tbody></table>
{/snippet}

{#snippet nonRunStep(step: WorkoutStep, indent: boolean)}
	{@const name = stepExerciseName(step)}
	{@const vals = stepValues(step)}
	<tr class="border-b border-card-border/20 hover:bg-card-border/10">
		<td class="py-1 pr-4 text-text-secondary whitespace-nowrap {indent ? 'pl-4' : ''}">{name ?? stepLabel(step.step_type)}</td>
		<td class="py-1 num text-text whitespace-nowrap">{vals}</td>
	</tr>
{/snippet}

{#snippet nonRunningSteps(steps: WorkoutStep[])}
	<table class="mt-2 ml-[26px] text-xs">
	<thead><tr class="text-text-dim border-b border-card-border">
		<th class="pb-1 pr-4 text-left font-medium">Exercise</th>
		<th class="pb-1 text-left font-medium">Reps/Time</th>
	</tr></thead>
	<tbody>
		{#each steps as step}
			{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
				<tr class="border-b border-card-border/20 bg-card-border/5">
					<td class="py-1 pr-4 num font-semibold text-text-secondary whitespace-nowrap" colspan="2">{step.number_of_iterations}×</td>
				</tr>
				{#each step.steps ?? [] as sub}
					{@render nonRunStep(sub, true)}
				{/each}
			{:else}
				{@render nonRunStep(step, false)}
			{/if}
		{/each}
	</tbody></table>
{/snippet}

{#snippet rowCard(row: Row)}
	{@const isToday = row.date === todayStr}
	{#if row.kind === 'done'}
		<!-- Completed activity — shared row component (has its own padding) -->
		<div class="rounded-lg bg-card {isToday ? 'ring-1 ring-blue-400/50' : ''}">
			<ActivityRow
				activity={row.activity}
				splits={splits[row.activity.id]}
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
		<div class="rounded-lg bg-card px-3 md:px-4 py-3 {isToday ? 'ring-1 ring-blue-400/50' : ''}">
			<div class="flex items-center gap-2.5 leading-5">
				<span class="shrink-0 leading-[0] text-red-400"><FlagCheckered size={16} weight="bold" /></span>
				<div class="min-w-0 flex-1 overflow-hidden">
					<div class="text-sm font-semibold text-text truncate">{row.entry.title}</div>
					{#if linkedCourse}
						<button
							class="flex items-center gap-3 mt-0.5 text-xs leading-none cursor-pointer hover:opacity-80 transition-opacity max-w-full overflow-hidden"
							onclick={() => onNavigateCourse?.(linkedCourse.id)}
						>
							<span class="flex items-center gap-1 text-text-secondary truncate min-w-0"><Path size={11} weight="bold" class="shrink-0" /> <span class="truncate">{linkedCourse.name}</span></span>
							<span class="num text-text font-semibold shrink-0">{formatDistance(linkedCourse.distance_meters)}<span class="text-text-dim font-normal">km</span></span>
							<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5"><TrendUp size={11} weight="bold" />{Math.round(linkedCourse.elevation_gain_meters)}m</span>
						</button>
					{/if}
				</div>
				<span class="num rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
					in {days} days
				</span>
			</div>
		</div>
	{:else if row.kind === 'scheduled'}
		<!-- Scheduled workout: collapsible -->
		{@const entry = row.entry}
		{@const hasDetails = entry.steps.length > 0 || entry.item_type === 'fbtAdaptiveWorkout'}
		<div class="rounded-lg bg-card px-3 md:px-4 py-3 {isToday ? 'ring-1 ring-blue-400/50' : ''}">
			<button
				class="flex w-full items-center gap-2.5 leading-5 text-left {hasDetails ? 'cursor-pointer' : ''}"
				onclick={() => hasDetails && toggle(entry.id)}
			>
				<span class="shrink-0 leading-[0] text-text-dim">
					{#if entry.item_type === 'fbtAdaptiveWorkout'}
						<Robot size={16} />
					{:else if isRunning(entry)}
						<PersonSimpleRun size={16} />
					{:else}
						<Barbell size={16} />
					{/if}
				</span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold text-text truncate">{entry.title}</div>
				</div>
				<span class="shrink-0 text-[10px] text-text-dim font-mono tabular-nums">{dateLabel(entry.date)}</span>
				{#if hasDetails}
					<span class="shrink-0 text-text-dim">
						{#if expanded.has(entry.id)}
							<CaretDown size={12} />
						{:else}
							<CaretRight size={12} />
						{/if}
					</span>
				{/if}
			</button>
			{#if expanded.has(entry.id)}
				{#if entry.item_type === 'fbtAdaptiveWorkout'}
					<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary pl-[26px]">
						{#if entry.workout_description}
							<span class="font-medium text-text">{entry.workout_description}</span>
						{/if}
						{#if entry.estimated_distance_meters}
							<span>{fmtDist(entry.estimated_distance_meters)}</span>
						{/if}
						{#if entry.estimated_duration_secs}
							<span>{fmtDuration(entry.estimated_duration_secs)}</span>
						{/if}
						{#if entry.training_effect_label && entry.training_effect_label !== 'UNKNOWN' && entry.training_effect_label !== 'INVALID'}
							<span class="capitalize">{entry.training_effect_label.toLowerCase().replace(/_/g, ' ')}</span>
						{/if}
					</div>
				{:else if entry.steps.length > 0}
					{#if isRunning(entry)}
						{@render runningSteps(entry.steps)}
					{:else}
						{@render nonRunningSteps(entry.steps)}
					{/if}
				{/if}
			{/if}
		</div>
	{:else if row.kind === 'rest'}
		<div class="rounded-lg bg-card px-3 md:px-4 py-3 opacity-40 {isToday ? 'ring-1 ring-blue-400/50 !opacity-60' : ''}">
			<div class="flex items-center gap-2.5 leading-5">
				<span class="shrink-0 leading-[0] text-text-secondary"><PauseCircle size={16} /></span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold text-text">Rest</div>
				</div>
				<span class="shrink-0 text-[10px] text-text-dim font-mono tabular-nums">{dateLabel(row.date)}</span>
			</div>
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
			<div class="rounded-lg bg-card px-3 md:px-4 py-3 text-xs text-text-dim">Nothing this week</div>
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
			<div class="rounded-lg bg-card px-3 md:px-4 py-3 text-xs text-text-dim">Nothing this week</div>
		{/if}
	</div>
</div>
