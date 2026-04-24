<script lang="ts">
	import type { CalendarEntry, WorkoutStep, Activity, ActivitySplit, ActivityWeather, HrZone, Course } from '$lib/types.js';
	import { today, weekMonday, addDays, daysBetween } from '$lib/dates.js';
	import { C, computeMedianLoad, loadColor as computeLoadColor } from '$lib/colors.js';
	import { formatDistance } from '$lib/format.js';
	import ActivityRow from './ActivityRow.svelte';
	import Tip from './Tip.svelte';
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
	import Timer from 'phosphor-svelte/lib/Timer';
	import CrosshairSimple from 'phosphor-svelte/lib/CrosshairSimple';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
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
	const courseMap = $derived(new Map(courses.map(c => [c.course_id, c])));
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
				const d = a.start_time_local.slice(0, 10);
				return d >= weekStart && d < weekEnd;
			})
			.map((a): Row => ({
				kind: 'done',
				id: a.activity_id,
				date: a.start_time_local.slice(0, 10),
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

	let expanded = $state(new Set<string>());

	function entryKey(entry: CalendarEntry): string {
		return entry.workout_uuid ?? String(entry.id);
	}

	function toggle(key: string) {
		const next = new Set(expanded);
		if (next.has(key)) next.delete(key);
		else next.add(key);
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
		return name.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

	const INSTRUCTION_LABELS: Record<number, string> = {
		1: 'easy', 2: 'moderate', 3: 'hard', 4: 'very hard', 5: 'max effort',
		6: 'warm up', 7: 'cool down', 8: 'recovery', 9: 'tempo',
		10: 'steady', 11: 'race pace', 12: 'all out',
	};

	function stepTarget(s: WorkoutStep): string {
		if (s.target_type === 'pace.zone' && s.target_value_one != null && s.target_value_two != null) {
			const [fast, slow] = s.target_value_one > s.target_value_two
				? [s.target_value_one, s.target_value_two]
				: [s.target_value_two, s.target_value_one];
			return `${fmtPace(fast)}–${fmtPace(slow)}`;
		}
		if (s.target_type === 'heart.rate.zone' && s.target_value_one != null && s.target_value_two != null) {
			const [lo, hi] = s.target_value_one < s.target_value_two
				? [s.target_value_one, s.target_value_two]
				: [s.target_value_two, s.target_value_one];
			return lo === hi ? `${lo} bpm` : `${lo}–${hi} bpm`;
		}
		if (s.target_type === 'instruction' && s.target_value_one != null) {
			return INSTRUCTION_LABELS[s.target_value_one] ?? '';
		}
		if (s.target_type === 'power.zone' && s.target_value_one != null && s.target_value_two != null) {
			const [lo, hi] = s.target_value_one < s.target_value_two
				? [s.target_value_one, s.target_value_two]
				: [s.target_value_two, s.target_value_one];
			return `${Math.round(lo)}–${Math.round(hi)} W`;
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

	// Short code + color by phrase category. Tooltip name uses the phrase's
	// prettified detail so Base variants show their specific flavor.
	const PHRASE_BADGE: Record<string, { code: string; color: string }> = {
		BASE: { code: 'AB', color: C.cyan },
		AEROBIC_LOW_SHORTAGE_BASE: { code: 'AB', color: C.cyan },
		RUNNING_HISTORY_SHORTENED_BASE: { code: 'AB', color: C.cyan },
		LONG_WORKOUT: { code: 'LR', color: C.cyan },
		TEMPO: { code: 'TP', color: C.orange },
		ANAEROBIC_SPEED: { code: 'SP', color: C.purple },
		FORCED_REST: { code: 'RS', color: C.textDim },
	};
	function prettyPhrase(phrase: string): string {
		return phrase.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
	}
	// Title-based fallback for coach workouts when the detailed workout_phrase
	// isn't available (e.g. /workout-service/fbt-adaptive didn't return it yet).
	const TITLE_BADGE: { match: RegExp; code: string; name: string; color: string }[] = [
		{ match: /strength/i,          code: 'ST', name: 'Strength',  color: C.purple },
		{ match: /long/i,              code: 'LR', name: 'Long Run',  color: C.cyan },
		{ match: /tempo|threshold/i,   code: 'TP', name: 'Tempo',     color: C.orange },
		{ match: /speed|interval|vo2/i,code: 'SP', name: 'Speed',     color: C.purple },
		{ match: /recovery|easy/i,     code: 'RC', name: 'Recovery',  color: C.textDim },
		{ match: /rest/i,              code: 'RS', name: 'Rest',      color: C.textDim },
		{ match: /base/i,              code: 'AB', name: 'Base',      color: C.cyan },
	];
	function phraseBadge(phrase: string | null, title: string | null): { code: string; name: string; color: string } | null {
		if (phrase) {
			if (phrase.startsWith('STRENGTH_')) return { code: 'ST', name: 'Strength', color: C.purple };
			const meta = PHRASE_BADGE[phrase];
			if (meta) return { code: meta.code, name: prettyPhrase(phrase), color: meta.color };
		}
		if (title) {
			const hit = TITLE_BADGE.find(t => t.match.test(title));
			if (hit) return { code: hit.code, name: hit.name, color: hit.color };
		}
		if (!phrase) return null;
		return { code: 'TR', name: 'Training', color: C.textDim };
	}

	function teValueColor(te: number): string {
		if (te >= 4.0) return C.purple;
		if (te >= 3.0) return C.orange;
		if (te >= 1.0) return C.cyan;
		return C.textDim;
	}

	function stepsEstimates(steps: WorkoutStep[]): { dist: number; time: number; count: number } {
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
		return { dist: totalDist, time: totalTime, count: stepCount };
	}

	function groupByDate(rows: Row[]): [string, Row[]][] {
		const map = new Map<string, Row[]>();
		for (const row of rows) {
			const group = map.get(row.date);
			if (group) group.push(row);
			else map.set(row.date, [row]);
		}
		return [...map.entries()];
	}

	function activitySummary(a: Activity): string {
		const parts: string[] = [];
		if (a.distance_meters) parts.push(fmtDist(a.distance_meters));
		if (a.average_speed_mps) parts.push(fmtPace(a.average_speed_mps));
		if (a.duration_seconds) parts.push(fmtDuration(a.duration_seconds));
		if (a.average_hr) parts.push(`${Math.round(a.average_hr)} bpm`);
		if (a.elevation_gain_meters && a.elevation_gain_meters > 50) parts.push(`+${Math.round(a.elevation_gain_meters)}m`);
		return parts.join(' · ');
	}
</script>

<!-- ── Snippets ─────────────────────────────────────────────────────────── -->

{#snippet runStep(step: WorkoutStep, depth: number)}
	<tr class="border-b border-card-border/20 hover:bg-card-border/10">
		<td class="py-1 pr-4 font-medium text-text-secondary whitespace-nowrap" style="padding-left: {depth * 16}px">{stepLabel(step.step_type)}</td>
		<td class="py-1 pr-4 num text-text whitespace-nowrap">{stepDuration(step)}</td>
		<td class="py-1 pr-4 num text-text-secondary whitespace-nowrap">{stepTarget(step)}</td>
		<td class="py-1 text-text-dim text-[11px]">{step.description ?? ''}</td>
	</tr>
{/snippet}

{#snippet runSteps(steps: WorkoutStep[], depth: number)}
	{#each steps as step}
		{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
			<tr class="border-b border-card-border/20 bg-card-border/5">
				<td class="py-1 pr-4 num font-semibold text-text-secondary whitespace-nowrap" colspan="4" style="padding-left: {depth * 16}px">{step.number_of_iterations}×</td>
			</tr>
			{@render runSteps(step.steps ?? [], depth + 1)}
		{:else}
			{@render runStep(step, depth)}
		{/if}
	{/each}
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
		{@render runSteps(steps, 0)}
	</tbody></table>
{/snippet}

{#snippet nonRunStep(step: WorkoutStep, depth: number)}
	{@const name = stepExerciseName(step)}
	{@const vals = stepValues(step)}
	<tr class="border-b border-card-border/20 hover:bg-card-border/10">
		<td class="py-1 pr-4 text-text-secondary whitespace-nowrap" style="padding-left: {depth * 16}px">{name ?? stepLabel(step.step_type)}</td>
		<td class="py-1 num text-text whitespace-nowrap">{vals}</td>
	</tr>
{/snippet}

{#snippet nonRunSteps(steps: WorkoutStep[], depth: number)}
	{#each steps as step}
		{#if step.type === 'RepeatGroupDTO' && step.number_of_iterations}
			<tr class="border-b border-card-border/20 bg-card-border/5">
				<td class="py-1 pr-4 num font-semibold text-text-secondary whitespace-nowrap" colspan="2" style="padding-left: {depth * 16}px">{step.number_of_iterations}×</td>
			</tr>
			{@render nonRunSteps(step.steps ?? [], depth + 1)}
		{:else}
			{@render nonRunStep(step, depth)}
		{/if}
	{/each}
{/snippet}

{#snippet nonRunningSteps(steps: WorkoutStep[])}
	<table class="mt-2 ml-[26px] text-xs">
	<thead><tr class="text-text-dim border-b border-card-border">
		<th class="pb-1 pr-4 text-left font-medium">Exercise</th>
		<th class="pb-1 text-left font-medium">Reps/Time</th>
	</tr></thead>
	<tbody>
		{@render nonRunSteps(steps, 0)}
	</tbody></table>
{/snippet}

{#snippet dayHeader(date: string)}
	{@const isToday = date === todayStr}
	{@const isPast = date < todayStr}
	{@const d = new Date(date + 'T12:00:00Z')}
	{@const weekday = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
	{@const dayMonth = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
	<div class="flex items-center gap-1.5">
		{#if isToday}
			<span class="text-blue-400 leading-[0]"><CrosshairSimple size={12} weight="bold" /></span>
		{:else if isPast}
			<span class="text-text-dim leading-[0]"><CheckCircle size={12} weight="duotone" /></span>
		{/if}
		<span class="text-[11px] font-semibold uppercase tracking-wide {isToday ? 'text-blue-400' : 'text-text-dim'}">
			{weekday}
		</span>
		<span class="text-[10px] {isToday ? 'text-blue-400 font-semibold' : 'text-text-dim'}">{dayMonth}</span>
	</div>
{/snippet}

{#snippet rowCard(row: Row)}
	{#if row.kind === 'done'}
		<div class="rounded-lg bg-card">
			<ActivityRow
				activity={row.activity}
				splits={splits[row.activity.activity_id]}
				weather={activityWeather[row.activity.activity_id] ?? null}
				{hrZones}
				loadColor={computeLoadColor(row.activity.activity_training_load, medianLoad)}
				context="calendar"
				{onNavigate}
			/>
		</div>
	{:else if row.kind === 'event'}
		{@const days = daysUntilDate(row.date)}
		{@const linkedCourse = row.entry.course_id ? courseMap.get(row.entry.course_id) ?? null : null}
		<div class="rounded-lg bg-card px-3 md:px-4 py-3">
			<div class="flex items-center gap-2.5 leading-5">
				<span class="shrink-0 leading-[0] text-red-400"><FlagCheckered size={16} weight="bold" /></span>
				<div class="min-w-0 flex-1 overflow-hidden">
					<div class="text-sm font-semibold text-text truncate">{row.entry.title}</div>
					{#if linkedCourse}
						<button
							class="flex items-center gap-3 mt-0.5 text-xs leading-none cursor-pointer hover:opacity-80 transition-opacity max-w-full overflow-hidden"
							onclick={() => onNavigateCourse?.(linkedCourse.course_id)}
						>
							<span class="flex items-center gap-1 text-text-secondary truncate min-w-0"><Path size={11} weight="bold" class="shrink-0" /> <span class="truncate">{linkedCourse.course_name}</span></span>
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
		{@const entry = row.entry}
		{@const hasSteps = entry.steps.length > 0}
		{@const key = entryKey(entry)}
		{@const isExpanded = expanded.has(key)}
		{@const badge = phraseBadge(entry.workout_phrase, entry.title)}
		{@const aeroTE = entry.estimated_training_effect}
		{@const anaeroTE = entry.estimated_anaerobic_training_effect}
		{@const est = hasSteps ? stepsEstimates(entry.steps) : null}
		{@const distM = entry.estimated_distance_meters ?? (est && est.dist > 0 ? est.dist : null)}
		{@const durS = entry.estimated_duration_seconds ?? (est && est.time > 0 ? est.time : null)}
		<div class="rounded-lg bg-card px-3 md:px-4 py-3">
			<button
				class="w-full text-left {hasSteps ? 'cursor-pointer' : 'cursor-default'}"
				onclick={() => hasSteps && toggle(key)}
				disabled={!hasSteps}
			>
				<div class="flex items-center gap-2.5 leading-5">
					<span class="shrink-0 leading-[0]" style="color: {badge?.color ?? C.textDim}">
						{#if entry.item_type === 'fbtAdaptiveWorkout'}
							<Robot size={16} weight="bold" />
						{:else if isRunning(entry)}
							<PersonSimpleRun size={16} weight="bold" />
						{:else}
							<Barbell size={16} weight="bold" />
						{/if}
					</span>
					{#if badge}
						<span class="shrink-0 num text-[10px] font-bold leading-[0] -ml-1" style="color: {badge.color}">
							<Tip text={badge.name}>{badge.code}</Tip>
						</span>
					{/if}
					<div class="min-w-0 flex-1">
						<span class="font-medium text-sm text-text">{entry.title}</span>
					</div>
					<span class="shrink-0 flex items-center gap-2 text-xs num ml-auto">
						{#if distM}
							<span class="text-text font-semibold">{fmtDist(distM)}</span>
						{/if}
						{#if durS}
							<span class="text-text-secondary inline-flex items-center gap-0.5"><Timer size={11} weight="bold" />{fmtDuration(durS)}</span>
						{/if}
						{#if aeroTE != null || anaeroTE != null}
							<span class="num font-semibold leading-none" style="color: {teValueColor(aeroTE ?? 0)}">{(aeroTE ?? 0).toFixed(1)}</span>
							<span class="num font-semibold leading-none" style="color: {teValueColor(anaeroTE ?? 0)}">{(anaeroTE ?? 0).toFixed(1)}</span>
						{:else if entry.workout_description}
							<span class="text-text-dim">{entry.workout_description}</span>
						{/if}
					</span>
					{#if hasSteps}
						<span class="shrink-0 leading-[0] text-text-dim transition-transform {isExpanded ? 'rotate-180' : ''}">
							<CaretDown size={12} weight="bold" />
						</span>
					{/if}
				</div>
			</button>
			{#if isExpanded && hasSteps}
				{#if isRunning(entry)}
					{@render runningSteps(entry.steps)}
				{:else}
					{@render nonRunningSteps(entry.steps)}
				{/if}
			{/if}
		</div>
	{:else if row.kind === 'rest'}
		<div class="rounded-lg bg-card px-3 md:px-4 py-3 opacity-40">
			<div class="flex items-center gap-2.5 leading-5">
				<span class="shrink-0 leading-[0] text-text-secondary"><PauseCircle size={16} /></span>
				<div class="min-w-0 flex-1">
					<div class="text-sm font-semibold text-text">Rest</div>
				</div>
			</div>
		</div>
	{/if}
{/snippet}

<!-- ── Layout ────────────────────────────────────────────────────────────── -->

<div class="mt-4 mb-1 flex flex-wrap items-center gap-3">
	<Tip text={"Your planned workouts, races, and courses for the next two weeks.\nNavigate weeks with the arrows to plan ahead."}>
		<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
			<CalendarBlank size={14} weight="bold" /> Calendar
		</h2>
	</Tip>
	<div class="flex items-center gap-1.5">
		<button
			class="cursor-pointer rounded p-1 text-text-dim hover:text-text-secondary hover:bg-card-border/30 transition-colors"
			onclick={() => weekOffset--}
			aria-label="Previous weeks"
		><CaretLeft size={14} weight="bold" /></button>
		<span class="num text-[10px] font-medium text-text-secondary">{weekLabel(thisWeekStr)}</span>
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
			<div class="grid gap-4">
				{#each groupByDate(thisWeekRows) as [date, rows]}
					<div>
						{@render dayHeader(date)}
						<div class="grid gap-2 mt-1.5">
							{#each rows as row}
								{@render rowCard(row)}
							{/each}
						</div>
					</div>
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
			<div class="grid gap-4">
				{#each groupByDate(nextWeekRows) as [date, rows]}
					<div>
						{@render dayHeader(date)}
						<div class="grid gap-2 mt-1.5">
							{#each rows as row}
								{@render rowCard(row)}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-lg bg-card px-3 md:px-4 py-3 text-xs text-text-dim">Nothing this week</div>
		{/if}
	</div>
</div>
