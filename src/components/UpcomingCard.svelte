<script lang="ts">
	import type { CalendarEntry, Activity, ActivitySplit, ActivityWeather, HrZone, Workout } from '$lib/types.js';
	import { weekMonday, addDays, daysBetween } from '$lib/dates.js';
	import { todayStore } from '$lib/today.svelte.js';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { C, computeMedianLoad, loadColor as computeLoadColor } from '$lib/colors.js';
	import { workoutBadge, teValueColor } from '$lib/badges.js';
	import { fmtDist, fmtPace, fmtDuration, stepsEstimates } from '$lib/workout-steps.js';
	import ActivityRow from './ActivityRow.svelte';
	import WorkoutSteps from './WorkoutSteps.svelte';
	import WorkoutPicker from './WorkoutPicker.svelte';
	import Tip from './Tip.svelte';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import FlagCheckered from 'phosphor-svelte/lib/FlagCheckered';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';
	import PauseCircle from 'phosphor-svelte/lib/PauseCircle';
	import Timer from 'phosphor-svelte/lib/Timer';
	import CrosshairSimple from 'phosphor-svelte/lib/CrosshairSimple';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import Robot from 'phosphor-svelte/lib/Robot';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Trash from 'phosphor-svelte/lib/Trash';

	interface Props {
		calendar: CalendarEntry[];
		activities: Activity[];
		splits: Record<number, ActivitySplit[]>;
		hrZones: HrZone[];
		activityWeather: Record<number, ActivityWeather>;
		workouts: Workout[];
		onNavigate?: (activityId: number) => void;
	}

	let { calendar, activities, splits, hrZones, activityWeather, workouts, onNavigate }: Props = $props();

	// Workout picker state — `pickerDate` doubles as visibility flag.
	let pickerDate = $state<string | null>(null);
	let scheduling = $state(false);

	function openPicker(date: string) {
		pickerDate = date;
	}

	async function pickWorkout(workoutId: number) {
		if (!pickerDate || scheduling) return;
		scheduling = true;
		const date = pickerDate;
		try {
			const res = await fetch('/api/calendar/workouts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ workout_id: workoutId, date }),
			});
			if (!res.ok) throw new Error(await res.text());
			toast.success('Workout scheduled');
			pickerDate = null;
			await invalidateAll();
		} catch (err) {
			toast.error("Couldn't schedule workout", { description: err instanceof Error ? err.message : undefined });
			console.error(err);
		} finally {
			scheduling = false;
		}
	}

	async function unschedule(entry: CalendarEntry) {
		if (!confirm(`Remove "${entry.title}" from ${entry.date}? This unschedules it from Garmin.`)) return;
		try {
			const res = await fetch(`/api/calendar/workouts/${entry.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(await res.text());
			toast.success('Workout unscheduled');
			await invalidateAll();
		} catch (err) {
			toast.error("Couldn't unschedule workout", { description: err instanceof Error ? err.message : undefined });
			console.error(err);
		}
	}

	const medianLoad = $derived(computeMedianLoad(activities.map(a => a.activity_training_load)));

	// ── Week boundaries (Monday-based) ──────────────────────────────────────

	// `todayStr` must stay live across syncs and midnight rollovers so that
	// "Today" highlight and the current-week label track real time without a
	// page reload. The store handles the 60s tick + visibility hook globally.
	const todayStr = $derived(todayStore.current);
	const currentWeekStr = $derived(weekMonday(todayStr));
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
		<!-- Schedule a workout on this day. Hidden for past days (Garmin's
		     `workouts schedule` accepts past dates but it's never useful and
		     would clutter completed days). -->
		{#if !isPast}
			<span class="ml-auto leading-[0]">
				<Tip text="Schedule a workout">
					<button
						type="button"
						class="cursor-pointer leading-[0] text-text-dim hover:text-blue-400 transition-colors"
						onclick={() => openPicker(date)}
						aria-label="Schedule a workout"
					><Plus size={12} weight="bold" /></button>
				</Tip>
			</span>
		{/if}
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
		{@const entry = row.entry}
		{@const distM = entry.estimated_distance_meters}
		{@const iconColor = entry.is_primary_event ? C.cyan : entry.is_race ? C.red : C.textSecondary}
		<div class="rounded-lg bg-card px-3 md:px-4 py-3">
			<div class="flex items-center gap-2.5 leading-5">
				<span class="shrink-0 leading-[0]" style="color: {iconColor}"><FlagCheckered size={16} weight="bold" /></span>
				<div class="min-w-0 flex-1">
					<span class="font-medium text-sm text-text">{entry.title}</span>
				</div>
				<span class="shrink-0 flex items-center gap-2 text-xs num ml-auto">
					{#if distM}
						<span class="text-text font-semibold">{fmtDist(distM)}</span>
					{/if}
					{#if entry.start_time_local}
						<span class="text-text-secondary">{entry.start_time_local}</span>
					{/if}
				</span>
			</div>
		</div>
	{:else if row.kind === 'scheduled'}
		{@const entry = row.entry}
		{@const hasSteps = entry.steps.length > 0}
		{@const key = entryKey(entry)}
		{@const isExpanded = expanded.has(key)}
		{@const badge = workoutBadge(entry.workout_phrase, entry.title)}
		{@const aeroTE = entry.estimated_training_effect}
		{@const anaeroTE = entry.estimated_anaerobic_training_effect}
		{@const est = hasSteps ? stepsEstimates(entry.steps) : null}
		{@const distM = entry.estimated_distance_meters ?? (est && est.dist > 0 ? est.dist : null)}
		{@const durS = entry.estimated_duration_seconds ?? (est && est.time > 0 ? est.time : null)}
		{@const descText = entry.workout_description?.trim() || '—'}
		<!-- Outer is `role="button"` (not <button>) so we can nest the
		     unschedule action button inside on row 2 right. -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="rounded-lg bg-card px-3 md:px-4 py-3 {hasSteps ? 'cursor-pointer' : ''}"
			role="button"
			tabindex="0"
			aria-expanded={hasSteps ? isExpanded : undefined}
			onclick={() => hasSteps && toggle(key)}
			onkeydown={(e) => {
				if (hasSteps && (e.key === 'Enter' || e.key === ' ')) {
					e.preventDefault();
					toggle(key);
				}
			}}
		>
			<!-- Row 1: icon + badge code + name + (badge.name as right-meta) + caret -->
			<div class="flex items-center gap-2.5 mb-1.5 leading-5">
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
					<div class="font-medium text-sm text-text truncate">{entry.title}</div>
				</div>
				<span class="shrink-0 flex items-center gap-2 text-[10px] text-text-dim">
					{#if badge}<span class="truncate">{badge.name}</span>{/if}
					{#if hasSteps}
						<span class="text-text-dim transition-transform {isExpanded ? 'rotate-180' : ''}">
							<CaretDown size={12} weight="bold" />
						</span>
					{/if}
				</span>
			</div>

			<!-- Row 2: dist + duration + description + (TE values + unschedule, right-aligned) -->
			<div class="flex flex-wrap items-end gap-x-3 gap-y-1.5 text-xs leading-none">
				{#if distM}
					<span class="num text-text font-semibold shrink-0">{fmtDist(distM)}</span>
				{/if}
				{#if durS}
					<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5"><Timer size={11} weight="bold" />{fmtDuration(durS)}</span>
				{/if}
				<span class="text-[11px] text-text-dim min-w-0 truncate">{descText}</span>

				<span class="flex items-center gap-2 shrink-0 ml-auto">
					{#if aeroTE != null || anaeroTE != null}
						<span class="flex items-center gap-1.5">
							<span class="num font-semibold leading-none" style="color: {teValueColor(aeroTE ?? 0)}">{(aeroTE ?? 0).toFixed(1)}</span>
							<span class="num font-semibold leading-none" style="color: {teValueColor(anaeroTE ?? 0)}">{(anaeroTE ?? 0).toFixed(1)}</span>
						</span>
					{/if}
					<button
						type="button"
						class="cursor-pointer text-text-dim hover:text-status-red transition-colors"
						onclick={(e) => { e.stopPropagation(); unschedule(entry); }}
						aria-label="Remove from calendar"
					><Trash size={12} weight="bold" /></button>
				</span>
			</div>
			{#if isExpanded && hasSteps}
				<div class="mt-2 ml-[26px]">
					<WorkoutSteps steps={entry.steps} sportType={entry.sport_type} />
				</div>
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
	<Tip text={"Your planned workouts, races, and courses for the next two weeks.\nNavigate weeks with the arrows to plan ahead.\nClick the title to jump back to this week."}>
		<button
			type="button"
			class="cursor-pointer flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary hover:text-text transition-colors"
			onclick={() => weekOffset = 0}
			aria-label="Jump to this week"
		>
			<CalendarBlank size={14} weight="bold" /> Calendar
		</button>
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

<WorkoutPicker
	{workouts}
	date={pickerDate}
	busy={scheduling}
	onClose={() => pickerDate = null}
	onPick={pickWorkout}
/>
