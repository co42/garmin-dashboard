<script lang="ts">
	import type { RaceEvent, Course } from '$lib/types.js';
	import { today, daysBetween } from '$lib/dates.js';
	import { C } from '$lib/colors.js';
	import { formatTime } from '$lib/format.js';
	import Tip from './Tip.svelte';
	import FlagCheckered from 'phosphor-svelte/lib/FlagCheckered';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import Bicycle from 'phosphor-svelte/lib/Bicycle';
	import PersonSimpleSwim from 'phosphor-svelte/lib/PersonSimpleSwim';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import Path from 'phosphor-svelte/lib/Path';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';

	interface Props {
		events: RaceEvent[];
		courses: Course[];
		lastSyncedAt: string | null;
		onNavigateCourse?: (courseId: number) => void;
	}

	let { events, courses, lastSyncedAt, onNavigateCourse }: Props = $props();

	const todayStr = today();
	const courseMap = $derived(new Map(courses.map(c => [c.course_id, c])));
	const sorted = $derived([...events].sort((a, b) => a.date.localeCompare(b.date)));

	// Projection freshness: events come from the latest sync, so the projection
	// snapshot is dated by `lastSyncedAt`. Mirrors PlanSummaryCard's TODAY / Nd AGO
	// label so the two cards read consistently.
	const projAge = $derived.by(() => {
		if (!lastSyncedAt) return null;
		const syncDay = new Date(lastSyncedAt).toISOString().slice(0, 10);
		return Math.max(0, daysBetween(syncDay, todayStr));
	});
	const projLabel = $derived(projAge === 0 ? 'TODAY' : projAge != null ? `${projAge}d AGO` : null);
	const projColor = $derived(projAge === 0 ? C.green : C.orange);

	function fmtDate(iso: string): string {
		const d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
		const wk = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
		const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
		return `${wk} ${dm}`;
	}

	function fmtDist(m: number): string {
		const km = m / 1000;
		return km % 1 === 0 ? `${km}km` : `${km.toFixed(2)}km`;
	}

	function fmtTimeDelta(secs: number): string {
		const sign = secs >= 0 ? '+' : '-';
		const a = Math.abs(secs);
		if (a < 60) return `${sign}${a}s`;
		const m = Math.floor(a / 60);
		const s = a % 60;
		if (a < 3600) return `${sign}${m}:${String(s).padStart(2, '0')}s`;
		const h = Math.floor(a / 3600);
		return `${sign}${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}s`;
	}
	function fmtPaceDelta(secsPerKm: number): string {
		const sign = secsPerKm >= 0 ? '+' : '-';
		const a = Math.abs(secsPerKm);
		const m = Math.floor(a / 60);
		const s = a % 60;
		return `${sign}${m}:${String(s).padStart(2, '0')}/km`;
	}
	function paceMSSPerKm(secs: number, meters: number): string {
		const spk = Math.round(secs / (meters / 1000));
		return `${Math.floor(spk / 60)}:${String(spk % 60).padStart(2, '0')}/km`;
	}

	function eventIcon(type: string | null) {
		if (!type) return PersonSimpleRun;
		if (type.includes('trail')) return Mountains;
		if (type.includes('cycling') || type.includes('bik')) return Bicycle;
		if (type.includes('swim')) return PersonSimpleSwim;
		if (type.includes('running')) return PersonSimpleRun;
		return FlagCheckered;
	}

	function iconColor(e: RaceEvent): string {
		if (e.is_primary_event) return C.cyan;
		if (e.is_race) return C.red;
		return C.textSecondary;
	}
</script>

<div class="mt-4 mb-1 flex items-center gap-3">
	<Tip text={"Your upcoming races and events.\nPrimary plan target shows projection vs goal."}>
		<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
			<FlagCheckered size={14} weight="bold" /> Events
		</h2>
	</Tip>
</div>

<div class="grid gap-2">
	{#each sorted as event}
		{@const Icon = eventIcon(event.event_type)}
		{@const days = daysBetween(todayStr, event.date)}
		{@const linkedCourse = event.course_id ? courseMap.get(event.course_id) ?? null : null}
		<div class="rounded-lg bg-card px-3 md:px-4 py-3">
			<div class="flex items-start gap-2.5 leading-5">
				<span class="shrink-0 leading-[0] mt-0.5" style="color: {iconColor(event)}">
					<Icon size={16} weight="bold" />
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2 flex-wrap">
						<span class="font-semibold text-sm text-text">{event.name}</span>
						{#if event.is_primary_event}
							<span class="num text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style="background: {C.cyan}1f; color: {C.cyan}">primary</span>
						{/if}
						{#if event.is_race}
							<span class="num text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style="background: {C.red}1f; color: {C.red}">race</span>
						{/if}
					</div>
					<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-text-secondary">
						<span class="num">{fmtDate(event.date)}</span>
						{#if event.start_time_local}
							<span class="text-text-dim">·</span>
							<span class="num">{event.start_time_local}</span>
						{/if}
						{#if event.distance_meters}
							<span class="text-text-dim">·</span>
							<span class="num text-text font-semibold">{fmtDist(event.distance_meters)}</span>
						{/if}
						{#if event.location}
							<span class="text-text-dim">·</span>
							<span class="inline-flex items-center gap-0.5 truncate min-w-0"><MapPin size={11} weight="bold" class="shrink-0 text-text-dim" /><span class="truncate">{event.location}</span></span>
						{/if}
						{#if linkedCourse}
							<span class="text-text-dim">·</span>
							<button
								type="button"
								class="inline-flex items-center gap-0.5 cursor-pointer text-text-secondary hover:text-text transition-colors"
								onclick={() => onNavigateCourse?.(linkedCourse.course_id)}
							><Path size={11} weight="bold" class="shrink-0" /><span class="truncate">{linkedCourse.course_name}</span></button>
						{/if}
						{#if event.url}
							<span class="text-text-dim">·</span>
							<a
								href={event.url}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-0.5 text-text-secondary hover:text-text transition-colors"
							><ArrowSquareOut size={11} weight="bold" /><span>site</span></a>
						{/if}
					</div>
				</div>
				<div class="shrink-0 num leading-none self-center text-xs font-semibold" style="color: {C.green}">
					in {days}d
				</div>
			</div>

			{#if event.is_primary_event && event.goal_seconds && event.distance_meters}
				{@const goalTimeDelta = event.projected_race_time_seconds
					? Math.round(event.projected_race_time_seconds - event.goal_seconds)
					: null}
				{@const goalPaceDelta = event.projected_race_time_seconds
					? Math.round(
						event.projected_race_time_seconds / (event.distance_meters / 1000)
						- event.goal_seconds / (event.distance_meters / 1000)
					)
					: null}
				<div class="mt-2 pt-2 border-t border-card-border/40 space-y-1">
					<div class="flex flex-wrap items-baseline gap-1.5 text-xs num">
						<span class="text-[10px] font-semibold uppercase tracking-wider text-text-dim">Goal</span>
						<span class="text-text">{formatTime(event.goal_seconds)}</span>
						<span class="text-text-dim">·</span>
						<span class="text-text-secondary">{paceMSSPerKm(event.goal_seconds, event.distance_meters)}</span>
					</div>
					{#if event.projected_race_time_seconds}
						<div class="flex flex-wrap items-baseline gap-1.5 text-xs num">
							<span class="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
								Projection {#if projLabel}<span style="color: {projColor}">({projLabel})</span>{/if}
							</span>
							<span class="text-text-dim">·</span>
							<span class="text-text font-semibold">{formatTime(event.projected_race_time_seconds)}</span>
							{#if goalTimeDelta != null}
								<span style="color: {goalTimeDelta <= 0 ? C.green : C.amber}">{fmtTimeDelta(goalTimeDelta)}</span>
							{/if}
							<span class="text-text-dim">·</span>
							<span class="text-text-secondary">{paceMSSPerKm(event.projected_race_time_seconds, event.distance_meters)}</span>
							{#if goalPaceDelta != null}
								<span style="color: {goalPaceDelta <= 0 ? C.green : C.amber}">{fmtPaceDelta(goalPaceDelta)}</span>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
