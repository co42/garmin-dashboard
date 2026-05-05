<script lang="ts">
	import type { CoachPlan, EventProjection, RaceEvent, Course } from '$lib/types.js';
	import { invalidateAll } from '$app/navigation';
	import { daysBetween } from '$lib/dates.js';
	import { todayStore } from '$lib/today.svelte.js';
	import { C } from '$lib/colors.js';
	import { toast } from 'svelte-sonner';
	import Tip from './Tip.svelte';
	import PhaseBar from './PhaseBar.svelte';
	import EventGoalProjection from './EventGoalProjection.svelte';
	import ProjectionChart from './ProjectionChart.svelte';
	import FlagCheckered from 'phosphor-svelte/lib/FlagCheckered';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import Bicycle from 'phosphor-svelte/lib/Bicycle';
	import PersonSimpleSwim from 'phosphor-svelte/lib/PersonSimpleSwim';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import Path from 'phosphor-svelte/lib/Path';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import DotsThreeVertical from 'phosphor-svelte/lib/DotsThreeVertical';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Crown from 'phosphor-svelte/lib/Crown';

	type Priority = 'primary' | 'secondary' | 'none';

	interface Props {
		event: RaceEvent;
		coachPlan: CoachPlan | null;
		projections: EventProjection[];
		courseMap: Map<number, Course>;
		onNavigateCourse?: (courseId: number) => void;
	}

	let { event, coachPlan, projections, courseMap, onNavigateCourse }: Props = $props();

	const todayStr = $derived(todayStore.current);
	const days = $derived(daysBetween(todayStr, event.date));
	const linkedCourse = $derived(event.course_id ? courseMap.get(event.course_id) ?? null : null);
	const latestProjection = $derived(projections.at(-1) ?? null);

	// What this event currently maps to in the priority tri-state. Mirrors the
	// CLI's update logic: primary = isPrimaryEvent; otherwise secondary when
	// flagged as a training event ("I'm training for this race"), else none.
	// (See garmin-cli's Priority::to_flags.)
	const currentPriority = $derived<Priority>(
		event.is_primary_event ? 'primary' : (event.is_training_event ? 'secondary' : 'none')
	);

	// Render the embedded plan/projection details only for primary events with
	// an active plan; non-primary events still get the projection chart when
	// Garmin has enough history (>= 2 points).
	const showPlan = $derived(event.is_primary_event && coachPlan != null);
	const DEAD_PLAN_STATUSES = new Set(['Completed', 'Paused', 'Cancelled']);
	const showPhaseBar = $derived(showPlan && !DEAD_PLAN_STATUSES.has(coachPlan?.training_status ?? ''));
	const hasProjectionChart = $derived(projections.length >= 2);

	// True when EventGoalProjection has anything to render — drives whether we
	// allocate the body grid at all when there's neither plan nor chart.
	const hasGoalProjectionBlock = $derived(
		event.goal_seconds != null
			|| latestProjection?.predicted_race_time_seconds != null
			|| latestProjection?.projection_race_time_seconds != null
			|| event.predicted_race_time_seconds != null
			|| event.projected_race_time_seconds != null
	);

	function fmtDate(iso: string): string {
		const d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
		const wk = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
		const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
		return `${wk} ${dm}`;
	}
	function fmtDateTime(e: RaceEvent): string {
		return e.start_time_local ? `${fmtDate(e.date)} ${e.start_time_local}` : fmtDate(e.date);
	}

	function eventIcon(type: string | null) {
		if (!type) return PersonSimpleRun;
		if (type.includes('trail')) return Mountains;
		if (type.includes('cycling') || type.includes('bik')) return Bicycle;
		if (type.includes('swim')) return PersonSimpleSwim;
		if (type.includes('running')) return PersonSimpleRun;
		return FlagCheckered;
	}
	const Icon = $derived(eventIcon(event.event_type));
	// Icon tint mirrors the priority pill color so the row reads consistently
	// at a glance: cyan = primary, red = secondary race, muted = none/training.
	const iconColor = $derived(
		currentPriority === 'primary' ? C.cyan
			: currentPriority === 'secondary' ? C.red
			: C.textSecondary
	);

	// ── Action menu ─────────────────────────────────────────────
	let menuOpen = $state(false);
	let menuRoot: HTMLDivElement | undefined = $state();
	let busy = $state(false);

	function onWindowClick(e: MouseEvent) {
		if (!menuOpen) return;
		if (menuRoot && !menuRoot.contains(e.target as Node)) {
			menuOpen = false;
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		window.addEventListener('click', onWindowClick);
		return () => window.removeEventListener('click', onWindowClick);
	});

	async function setPriority(target: Priority) {
		menuOpen = false;
		if (target === currentPriority) return;
		// Setting an event to primary triggers a Garmin-side plan rebuild.
		// Confirm explicitly so it's not a mis-click.
		if (target === 'primary') {
			if (!confirm(`Set "${event.name}" as primary? Garmin will rebuild your active plan around this event.`)) return;
		}
		busy = true;
		const previous = currentPriority;
		try {
			const res = await fetch(`/api/events/${event.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ priority: target }),
			});
			if (!res.ok) throw new Error(await res.text());
			toast.success(`Set "${event.name}" to ${target}`);
			await invalidateAll();
		} catch (err) {
			toast.error(`Couldn't change priority`, { description: previous === target ? undefined : `Was ${previous}` });
			console.error(err);
		} finally {
			busy = false;
		}
	}

	async function deleteEvent() {
		menuOpen = false;
		if (!confirm(`Delete "${event.name}"? This removes it from Garmin and can't be undone.`)) return;
		busy = true;
		try {
			const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(await res.text());
			toast.success(`Deleted "${event.name}"`);
			await invalidateAll();
		} catch (err) {
			toast.error(`Couldn't delete event`);
			console.error(err);
		} finally {
			busy = false;
		}
	}
</script>

<div class="rounded-lg bg-card px-3 md:px-4 py-3 relative" class:opacity-60={busy}>
	<!-- Title row: icon + name + primary/race + countdown pills + action menu. -->
	<div class="flex items-start gap-2.5 leading-5">
		<span class="shrink-0 leading-[0] mt-0.5" style="color: {iconColor}">
			<Icon size={16} weight="bold" />
		</span>
		<div class="min-w-0 flex-1 flex items-baseline gap-2">
			<span class="min-w-0 flex-1 font-semibold text-sm text-text break-words">{event.name}</span>
			<div class="shrink-0 flex items-center gap-1.5 self-start mt-0.5">
				<!-- Priority pill encodes both "this is the plan target" (primary,
				     cyan) and "this is a race I care about" (secondary, red). The
				     `none` state has no pill — training events don't need a callout. -->
				{#if currentPriority === 'primary'}
					<span class="num text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded leading-tight" style="background: {C.cyan}1f; color: {C.cyan}">primary</span>
				{:else if currentPriority === 'secondary'}
					<span class="num text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded leading-tight" style="background: {C.red}1f; color: {C.red}">secondary</span>
				{/if}
				<span class="num text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded leading-tight" style="background: {C.green}1f; color: {C.green}">{days}d</span>
			</div>
		</div>

		<!-- Action menu. Click-outside closes it; window listener registered in $effect. -->
		<div bind:this={menuRoot} class="relative shrink-0 -mr-1 -mt-1">
			<button
				type="button"
				class="p-1 rounded text-text-dim hover:text-text hover:bg-card-border/40 transition-colors cursor-pointer disabled:cursor-not-allowed"
				onclick={() => (menuOpen = !menuOpen)}
				disabled={busy}
				aria-label="Event actions"
			><DotsThreeVertical size={16} weight="bold" /></button>

			{#if menuOpen}
				<div class="absolute right-0 top-full mt-1 z-30 min-w-[180px] rounded-md border border-card-border bg-card shadow-lg py-1 text-xs">
					{#each [{ key: 'primary', label: 'Set as primary', icon: Crown, color: C.cyan }, { key: 'secondary', label: 'Set as secondary', icon: FlagCheckered, color: C.red }, { key: 'none', label: 'Set as training', icon: PersonSimpleRun, color: C.textSecondary }] as opt}
						{@const isCurrent = currentPriority === opt.key}
						<button
							type="button"
							class="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors {isCurrent ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-card-border/40'}"
							disabled={isCurrent}
							onclick={() => setPriority(opt.key as Priority)}
						>
							<span style="color: {opt.color}"><opt.icon size={12} weight="bold" /></span>
							<span class="text-text">{opt.label}</span>
						</button>
					{/each}
					<div class="my-1 border-t border-card-border"></div>
					<button
						type="button"
						class="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-card-border/40 transition-colors"
						onclick={deleteEvent}
					>
						<span style="color: {C.red}"><Trash size={12} weight="bold" /></span>
						<span style="color: {C.red}">Delete event</span>
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Date + location row. Lives at the card's left edge, no indent under the icon. -->
	<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-text-secondary">
		<span class="num">{fmtDateTime(event)}</span>
		{#if event.location}
			<span class="text-text-dim">·</span>
			<span class="inline-flex items-center gap-0.5 min-w-0">
				<MapPin size={11} weight="bold" class="shrink-0 text-text-dim" />
				<span class="truncate">{event.location}</span>
			</span>
		{/if}
	</div>

	<!-- Body: always 2 columns on desktop. Left = plan + goal/projection block,
	     right = projection chart (or empty space if Garmin has no history yet —
	     keeps the left column at 50% so cards line up at the same width). -->
	{#if (showPhaseBar && coachPlan) || hasGoalProjectionBlock || hasProjectionChart}
		<div class="mt-3 pt-3 border-t border-card-border grid gap-3 md:grid-cols-2 md:gap-4">
			<!-- Left: plan phase bar + goal/current/projection grid. The phase bar
			     speaks for itself here — the event title already names the plan target. -->
			<div class="space-y-5 min-w-0">
				{#if showPhaseBar && coachPlan}
					<PhaseBar plan={coachPlan} {event} />
				{/if}
				<EventGoalProjection {event} latest={latestProjection} />
			</div>

			<!-- Right: race projection chart. min-w-0 prevents the echarts SVG
			     from forcing the parent grid track to overflow. -->
			{#if hasProjectionChart}
				<!-- Phone-only separator: when the grid collapses to a single
				     column, the chart stacks below the goal block and needs a
				     visual break. On desktop the side-by-side layout already
				     separates them. -->
				<div class="min-w-0 border-t border-card-border pt-3 md:border-t-0 md:pt-0">
					<ProjectionChart history={projections} {event} planStartDate={showPlan ? coachPlan?.start_date ?? null : null} embedded />
				</div>
			{/if}
		</div>
	{/if}

	<!-- Course + site links footer. -->
	{#if linkedCourse || event.url}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] mt-3 pt-3 border-t border-card-border">
			{#if linkedCourse}
				<button
					type="button"
					class="inline-flex items-center gap-1 cursor-pointer text-text-secondary hover:text-text transition-colors min-w-0"
					onclick={() => onNavigateCourse?.(linkedCourse.course_id)}
				><Path size={11} weight="bold" class="shrink-0" /><span class="truncate">{linkedCourse.course_name}</span></button>
			{/if}
			{#if event.url}
				<a
					href={event.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 text-text-secondary hover:text-text transition-colors"
				><ArrowSquareOut size={11} weight="bold" /><span>site</span></a>
			{/if}
		</div>
	{/if}
</div>
