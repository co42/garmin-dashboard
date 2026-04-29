<script lang="ts">
	import type { CoachEvent, CoachPhase, CoachPlan, EventProjection } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import { today, daysBetween } from '$lib/dates.js';
	import { formatTime } from '$lib/format.js';
	import Tip from './Tip.svelte';
	import Trophy from 'phosphor-svelte/lib/Trophy';

	interface Props {
		plan: CoachPlan;
		event: CoachEvent;
		today: EventProjection | null;
	}

	let { plan, event, today: todayProj }: Props = $props();

	const todayStr = $derived(today());

	function phaseLabel(phase: string): string {
		if (phase === 'TARGET_EVENT_DAY') return 'RACE';
		return phase.replace(/_/g, ' ');
	}

	// Phase coverage determines the bar (not plan.start_date/end_date, which can
	// over- or undershoot the sum of phase durations). Widths sum to 100%.
	const phaseCoverage = $derived.by(() => {
		const sorted = [...plan.phases].sort((a, b) => a.start_date.localeCompare(b.start_date));
		const totalDays = sorted.reduce((s, p) => s + Math.max(1, daysBetween(p.start_date, p.end_date)), 0);
		const coverageStart = sorted[0]?.start_date ?? plan.start_date;
		return { sorted, totalDays: Math.max(1, totalDays), coverageStart };
	});

	const progress = $derived.by(() => {
		const { sorted, totalDays, coverageStart } = phaseCoverage;
		let elapsedPhaseDays = 0;
		const todayDay = daysBetween(coverageStart, todayStr);
		for (const p of sorted) {
			const ps = daysBetween(coverageStart, p.start_date);
			const dur = Math.max(1, daysBetween(p.start_date, p.end_date));
			if (todayDay >= ps + dur) elapsedPhaseDays += dur;
			else if (todayDay > ps) elapsedPhaseDays += (todayDay - ps);
		}
		const pct = (elapsedPhaseDays / totalDays) * 100;
		const weeksElapsed = Math.max(1, Math.ceil(elapsedPhaseDays / 7));
		const totalWeeks = plan.duration_weeks ?? Math.ceil(totalDays / 7);
		return { pct, weeksElapsed, totalWeeks };
	});
	const daysToRace = $derived(daysBetween(todayStr, event.date));

	// Phases ordered with per-segment geometry + status
	type PhaseInfo = {
		phase: CoachPhase;
		widthPct: number;
		durationDays: number;
		status: 'past' | 'current' | 'future';
		daysInto: number;
		daysLeft: number;
		daysUntil: number;
		pastWithinPct: number; // stripe overlay width: 0 (fully future) → 100 (fully past)
		color: string;
	};

	// Phase-themed palette: BUILD = foundation (blue), PEAK = high-intensity (orange),
	// TAPER = easing down (cyan), RACE = goal achieved (green).
	function phaseColor(type: string): string {
		if (type === 'TARGET_EVENT_DAY') return C.green;
		const t = type.toUpperCase();
		if (t.startsWith('BUILD')) return C.blue;
		if (t.startsWith('PEAK'))  return C.orange;
		if (t.startsWith('TAPER')) return C.cyan;
		return C.textSecondary;
	}

	const phaseInfos = $derived.by<PhaseInfo[]>(() => {
		const { sorted, totalDays, coverageStart } = phaseCoverage;
		const todayDay = daysBetween(coverageStart, todayStr);
		return sorted.map(p => {
			const startDay = daysBetween(coverageStart, p.start_date);
			const duration = Math.max(1, daysBetween(p.start_date, p.end_date));
			const endDay = startDay + duration;
			let status: 'past' | 'current' | 'future';
			if (p.current_phase) status = 'current';
			else if (endDay <= todayDay) status = 'past';
			else status = 'future';
			let pastWithinPct = 0;
			if (endDay <= todayDay) pastWithinPct = 100;
			else if (startDay < todayDay) pastWithinPct = ((todayDay - startDay) / duration) * 100;
			return {
				phase: p,
				widthPct: (duration / totalDays) * 100,
				durationDays: duration,
				status,
				daysInto: Math.max(0, todayDay - startDay),
				daysLeft: Math.max(0, endDay - todayDay),
				daysUntil: Math.max(0, startDay - todayDay),
				pastWithinPct,
				color: phaseColor(p.training_phase),
			};
		});
	});

	function paceMSSPerKm(secs: number, meters: number): string {
		const spk = Math.round(secs / (meters / 1000));
		return `${Math.floor(spk / 60)}:${String(spk % 60).padStart(2, '0')}/km`;
	}

	// Signed delta vs the goal for projection / current race-time predictions.
	function timeDeltaVsGoal(secs: number | null | undefined): number | null {
		if (secs == null || !event.goal_seconds) return null;
		return Math.round(secs - event.goal_seconds);
	}
	function paceDeltaVsGoal(secs: number | null | undefined): number | null {
		if (secs == null || !event.goal_seconds || !event.distance_meters) return null;
		const km = event.distance_meters / 1000;
		return Math.round(secs / km - event.goal_seconds / km);
	}
	function fmtTimeDelta(secs: number): string {
		const sign = secs >= 0 ? '+' : '−';
		const a = Math.abs(secs);
		if (a < 60) return `${sign}${a}s`;
		const m = Math.floor(a / 60);
		const s = a % 60;
		if (a < 3600) return `${sign}${m}:${String(s).padStart(2, '0')}`;
		const h = Math.floor(a / 3600);
		return `${sign}${h}:${String(m % 60).padStart(2, '0')}`;
	}
	function fmtPaceDelta(secsPerKm: number): string {
		const sign = secsPerKm >= 0 ? '+' : '−';
		const a = Math.abs(secsPerKm);
		const m = Math.floor(a / 60);
		const s = a % 60;
		return m > 0 ? `${sign}${m}:${String(s).padStart(2, '0')}` : `${sign}${s}s`;
	}
	function deltaColor(delta: number | null): string {
		if (delta == null) return C.textDim;
		return delta <= 0 ? C.green : C.amber;
	}

	// Age of the latest projection — surfaced as a relative-time badge next to
	// the Current column so a stale projection (e.g. a week-old sync) is
	// obvious at a glance.
	const projAge = $derived(todayProj ? daysBetween(todayProj.date, todayStr) : null);
	const projAgeLabel = $derived(
		projAge == null ? null
			: projAge === 0 ? 'TODAY'
			: projAge === 1 ? '1d AGO'
			: `${projAge}d AGO`
	);
	const projAgeColor = $derived(projAge === 0 ? C.green : C.orange);

	// Race-time projections + signed deltas vs goal. Computed in script so
	// they stay reactive without violating Svelte's `{@const}` placement rules
	// (which only allow it as a direct child of {#if}/{#each}/...).
	const projTime = $derived(todayProj?.projection_race_time_seconds ?? null);
	const curTime = $derived(todayProj?.predicted_race_time_seconds ?? null);
	const projTimeDelta = $derived(timeDeltaVsGoal(projTime));
	const projPaceDelta = $derived(paceDeltaVsGoal(projTime));
	const curTimeDelta = $derived(timeDeltaVsGoal(curTime));
	const curPaceDelta = $derived(paceDeltaVsGoal(curTime));

	function statusPillColor(status: string | null): { bg: string; fg: string } {
		switch (status) {
			case 'Scheduled': return { bg: C.blue, fg: C.blue };
			case 'Completed': return { bg: C.green, fg: C.green };
			case 'Paused':    return { bg: C.amber, fg: C.amber };
			default:          return { bg: C.textDim, fg: C.textDim };
		}
	}
	const pill = $derived(statusPillColor(plan.training_status));

	function fmtDate(iso: string): string {
		const d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
		return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
	}
	function fmtEventDateTime(e: CoachEvent): string {
		return e.start_time_local ? `${fmtDate(e.date)} ${e.start_time_local.slice(0, 5)}` : fmtDate(e.date);
	}

</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="flex items-center justify-between mb-1">
		<Tip text={"Your active adaptive training plan.\nProgress, phase, and race target at a glance."}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
				<Trophy size={14} weight="bold" /> Plan
			</h2>
		</Tip>
		{#if plan.training_status}
			<span
				class="rounded px-2 py-0.5 text-[10px] font-medium"
				style="background: {pill.bg}15; color: {pill.fg}"
			>
				{plan.training_status}
			</span>
		{/if}
	</div>
	<div class="text-sm text-text mb-3">{plan.name}</div>

	<!-- Progress meta row (above bar) -->
	{#if phaseInfos.length > 0}
		<div class="flex items-baseline justify-between mb-1.5 text-[10px] uppercase tracking-wider text-text-dim">
			<span>Week <span class="num text-text-secondary">{progress.weeksElapsed}</span> of <span class="num text-text-secondary">{progress.totalWeeks}</span></span>
			<span>
				<span class="num text-text-secondary">{progress.pct.toFixed(0)}%</span> · <span class="num text-text-secondary">{daysToRace}d</span> to race
			</span>
		</div>

		<!-- Phased progress bar -->
		<div class="relative mb-4">
			<div class="flex items-stretch h-5 gap-px">
				{#each phaseInfos as info}
					{@const isRace = info.phase.training_phase === 'TARGET_EVENT_DAY'}
					<div class="phase-seg relative flex" style="width: {info.widthPct}%">
						<div
							class="phase-fill flex-1 flex items-center justify-center overflow-hidden whitespace-nowrap relative"
							style="background: {info.color}30;"
						>
							{#if info.pastWithinPct > 0}
								<div
									class="phase-past absolute inset-y-0 left-0"
									style="width: {info.pastWithinPct}%; background-image: repeating-linear-gradient(45deg, {info.color}b3 0 4px, transparent 4px 8px);"
								></div>
							{/if}
							<span
								class="relative z-10 text-[9px] uppercase tracking-wider px-1 text-text"
								style="font-weight: {info.status === 'current' ? 700 : 600};"
							>{isRace ? 'R' : phaseLabel(info.phase.training_phase)}</span>
						</div>
						<span class="phase-tip num">
							<span class="phase-tip-title" style="color: {info.color}">
								{phaseLabel(info.phase.training_phase)}
							</span>
							<br/>
							{#if info.durationDays === 1}
								{fmtDate(info.phase.start_date)}
							{:else}
								{fmtDate(info.phase.start_date)} → {fmtDate(info.phase.end_date)}
							{/if}
							<br/>
							<span style="color: {C.textDim}">
								{info.durationDays} day{info.durationDays === 1 ? '' : 's'}
							</span>
							{#if info.status === 'current'}
								<br/>
								<span style="color: {info.color}">● day {info.daysInto + 1} of {info.durationDays} · {info.daysLeft}d left</span>
							{:else if info.status === 'future'}
								<br/>
								<span style="color: {C.textDim}">starts in {info.daysUntil}d</span>
							{:else}
								<br/>
								<span style="color: {C.textDim}">completed</span>
							{/if}
						</span>
					</div>
				{/each}
			</div>
			<!-- Today marker -->
			<div
				class="absolute pointer-events-none"
				style="left: {progress.pct}%; top: -3px; bottom: -3px; width: 2px; transform: translateX(-50%); background: {C.text}; box-shadow: 0 0 0 1px {C.card}; border-radius: 1px;"
			></div>
		</div>
	{/if}

	<!-- Goal · Event — 2-column row with divider, original layout. -->
	<div class="flex items-start gap-x-5 mb-3">
		<div class="flex-1 min-w-0">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-0.5">Goal</p>
			{#if event.goal_seconds}
				<p class="num text-xs text-text whitespace-nowrap flex items-baseline gap-1.5">
					<span>{formatTime(event.goal_seconds)}</span>
					{#if event.distance_meters}
						<span class="text-text-dim">·</span>
						<span class="text-text-secondary">{paceMSSPerKm(event.goal_seconds, event.distance_meters)}</span>
					{/if}
				</p>
			{:else}
				<p class="num text-xs text-text-dim">—</p>
			{/if}
			<p class="num text-xs text-text-secondary">{event.distance_meters ? (event.distance_meters / 1000).toFixed(2) + ' km' : '—'}</p>
		</div>
		<div class="self-stretch w-px bg-card-border"></div>
		<div class="flex-1 min-w-0">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-0.5">Event</p>
			<p class="num text-xs text-text whitespace-nowrap">{fmtEventDateTime(event)}</p>
			{#if event.location}
				<p class="text-xs text-text-secondary truncate" title={event.location}>{event.location}</p>
			{:else}
				<p class="text-xs text-text-dim">—</p>
			{/if}
		</div>
	</div>

	<!-- Current · Projection — same 2-col split as Goal/Event.
	     Current    = today's fitness-only predicted time. The TODAY / Xd AGO
	                  age badge sits on Current so a stale sync is obvious.
	     Projection = plan-adjusted forecast at race day. -->
	<div class="flex items-start gap-x-5 mt-auto">
		<div class="flex-1 min-w-0">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-0.5 flex items-baseline gap-1.5">
				<span>Current</span>
				{#if projAgeLabel}
					<span class="num text-[9px]" style="color: {projAgeColor}">({projAgeLabel})</span>
				{/if}
			</p>
			{#if curTime != null}
				<p class="num text-xs text-text whitespace-nowrap flex items-baseline gap-1.5">
					<span>{formatTime(curTime)}</span>
					{#if curTimeDelta != null}
						<span class="text-[10px]" style="color: {deltaColor(curTimeDelta)}">{fmtTimeDelta(curTimeDelta)}</span>
					{/if}
				</p>
				{#if event.distance_meters}
					<p class="num text-xs text-text-secondary whitespace-nowrap flex items-baseline gap-1.5">
						<span>{paceMSSPerKm(curTime, event.distance_meters)}</span>
						{#if curPaceDelta != null}
							<span class="text-[10px]" style="color: {deltaColor(curPaceDelta)}">{fmtPaceDelta(curPaceDelta)}</span>
						{/if}
					</p>
				{/if}
			{:else}
				<p class="num text-xs text-text-dim italic">—</p>
			{/if}
		</div>
		<div class="self-stretch w-px bg-card-border"></div>
		<div class="flex-1 min-w-0">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-0.5">Projection</p>
			{#if projTime != null}
				<p class="num text-xs text-text whitespace-nowrap flex items-baseline gap-1.5">
					<span>{formatTime(projTime)}</span>
					{#if projTimeDelta != null}
						<span class="text-[10px]" style="color: {deltaColor(projTimeDelta)}">{fmtTimeDelta(projTimeDelta)}</span>
					{/if}
				</p>
				{#if event.distance_meters}
					<p class="num text-xs text-text-secondary whitespace-nowrap flex items-baseline gap-1.5">
						<span>{paceMSSPerKm(projTime, event.distance_meters)}</span>
						{#if projPaceDelta != null}
							<span class="text-[10px]" style="color: {deltaColor(projPaceDelta)}">{fmtPaceDelta(projPaceDelta)}</span>
						{/if}
					</p>
				{/if}
			{:else}
				<p class="num text-xs text-text-dim italic">—</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.phase-seg {
		position: relative;
		cursor: help;
	}
	.phase-seg:first-child .phase-fill {
		border-top-left-radius: 3px;
		border-bottom-left-radius: 3px;
	}
	.phase-seg:last-child .phase-fill {
		border-top-right-radius: 3px;
		border-bottom-right-radius: 3px;
	}
	.phase-seg:hover .phase-fill {
		filter: brightness(1.25);
	}
	.phase-tip {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		display: none;
		z-index: 50;
		width: max-content;
		max-width: min(280px, calc(100vw - 24px));
		padding: 8px 12px;
		border-radius: 6px;
		background: #1e1e2a;
		border: 1px solid #2a2a3a;
		color: #c8c8d4;
		font-size: 11px;
		line-height: 1.6;
		white-space: normal;
		pointer-events: none;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		text-align: left;
	}
	.phase-tip-title {
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.phase-seg:hover .phase-tip {
		display: block;
	}
	/* Last segment's tooltip anchor pushed left so it doesn't get clipped */
	.phase-seg:last-child .phase-tip {
		left: auto;
		right: 0;
		transform: none;
	}
	/* First segment's tooltip pushed right too */
	.phase-seg:first-child .phase-tip {
		left: 0;
		transform: none;
	}
</style>
