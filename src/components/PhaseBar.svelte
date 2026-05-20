<script lang="ts">
	import type { CoachPhase, CoachPlan, RaceEvent } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import { addDays, daysBetween } from '$lib/dates.js';
	import { todayStore } from '$lib/today.svelte.js';

	interface Props {
		plan: CoachPlan;
		event: RaceEvent;
	}

	let { plan, event }: Props = $props();

	const todayStr = $derived(todayStore.current);

	function phaseLabel(phase: string): string {
		if (phase === 'TARGET_EVENT_DAY') return 'RACE';
		return phase.replace(/_/g, ' ');
	}

	// Phase end_dates are inclusive (e.g. PEAK Apr 30 → May 20 = 21 days), so all
	// duration math is `daysBetween(start, end) + 1`.
	//
	// Garmin's API drops past phases once they're complete — for a plan in PEAK,
	// only PEAK / TAPER / TARGET_EVENT_DAY are returned. We synthesize a leading
	// BUILD phase from plan.start_date to the day before the first real phase so
	// the bar geometry, week counter, and progress % all reflect the true plan.
	function phaseDuration(p: CoachPhase): number {
		return daysBetween(p.start_date, p.end_date) + 1;
	}

	const phaseCoverage = $derived.by(() => {
		const sorted = [...plan.phases].sort((a, b) => a.start_date.localeCompare(b.start_date));
		if (sorted.length > 0 && plan.start_date < sorted[0].start_date) {
			sorted.unshift({
				start_date: plan.start_date,
				end_date: addDays(sorted[0].start_date, -1),
				training_phase: 'BUILD',
				current_phase: false,
			});
		}
		const totalDays = sorted.reduce((s, p) => s + phaseDuration(p), 0);
		const coverageStart = sorted[0]?.start_date ?? plan.start_date;
		return { sorted, totalDays: Math.max(1, totalDays), coverageStart };
	});

	const progress = $derived.by(() => {
		const { sorted, totalDays, coverageStart } = phaseCoverage;
		let elapsedPhaseDays = 0;
		const todayDay = daysBetween(coverageStart, todayStr);
		for (const p of sorted) {
			const ps = daysBetween(coverageStart, p.start_date);
			const dur = phaseDuration(p);
			if (todayDay >= ps + dur) elapsedPhaseDays += dur;
			else if (todayDay >= ps) elapsedPhaseDays += (todayDay - ps);
		}
		const pct = (elapsedPhaseDays / totalDays) * 100;
		const weeksElapsed = Math.max(1, Math.ceil(elapsedPhaseDays / 7));
		const totalWeeks = plan.duration_weeks ?? Math.ceil(totalDays / 7);
		return { pct, weeksElapsed, totalWeeks };
	});
	const daysToRace = $derived(daysBetween(todayStr, event.date));

	type PhaseInfo = {
		phase: CoachPhase;
		widthPct: number;
		durationDays: number;
		status: 'past' | 'current' | 'future';
		daysInto: number;
		daysLeft: number;
		daysUntil: number;
		color: string;
	};

	// Phase palette aligned with the activity-badge / load-focus scheme:
	//   BUILD = base building       → blue   (low aerobic)
	//   PEAK  = high-intensity work → orange (high aerobic)
	//   TAPER = easing back         → teal
	//   RACE  = goal day            → green
	function phaseColor(type: string): string {
		if (type === 'TARGET_EVENT_DAY') return C.green;
		const t = type.toUpperCase();
		if (t.startsWith('BUILD')) return C.blue;
		if (t.startsWith('PEAK')) return C.orange;
		if (t.startsWith('TAPER')) return C.teal;
		return C.textSecondary;
	}

	const phaseInfos = $derived.by<PhaseInfo[]>(() => {
		const { sorted, totalDays, coverageStart } = phaseCoverage;
		const todayDay = daysBetween(coverageStart, todayStr);
		return sorted.map(p => {
			const startDay = daysBetween(coverageStart, p.start_date);
			const duration = phaseDuration(p);
			const endDay = startDay + duration;
			let status: 'past' | 'current' | 'future';
			if (p.current_phase) status = 'current';
			else if (endDay <= todayDay) status = 'past';
			else status = 'future';
			return {
				phase: p,
				widthPct: (duration / totalDays) * 100,
				durationDays: duration,
				status,
				daysInto: Math.max(0, todayDay - startDay),
				daysLeft: Math.max(0, endDay - todayDay),
				daysUntil: Math.max(0, startDay - todayDay),
				color: phaseColor(p.training_phase),
			};
		});
	});

	function fmtDate(iso: string): string {
		const d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
		return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
	}
</script>

{#if phaseInfos.length > 0}
	<div class="flex items-baseline justify-between mb-1.5 text-[10px] uppercase tracking-wider text-text-dim">
		<span>Week <span class="num text-text-secondary">{progress.weeksElapsed}</span> of <span class="num text-text-secondary">{progress.totalWeeks}</span></span>
		<span>
			<span class="num text-text-secondary">{progress.pct.toFixed(0)}%</span> · <span class="num text-text-secondary">{daysToRace}d</span> to race
		</span>
	</div>

	<!-- Dim past/future segments via background alpha (color + 30 ≈ 19% / e6 ≈ 90%)
	     instead of CSS opacity so the inline phase label stays fully opaque.
	     Today marker is a vertical white tick that pokes ±3px above/below the bar. -->
	<div class="relative">
		<div class="flex items-stretch h-5 gap-px">
			{#each phaseInfos as info}
				{@const isRace = info.phase.training_phase === 'TARGET_EVENT_DAY'}
				{@const fillBg = info.status === 'current' ? `${info.color}e6` : `${info.color}30`}
				<div class="phase-seg relative flex" style="width: {info.widthPct}%">
					<div
						class="phase-fill flex-1 flex items-center justify-center overflow-hidden whitespace-nowrap relative"
						style="background: {fillBg};"
					>
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
		<div
			class="absolute pointer-events-none"
			style="left: {progress.pct}%; top: -3px; bottom: -3px; width: 2px; transform: translateX(-50%); background: {C.text}; box-shadow: 0 0 0 1px {C.card}; border-radius: 1px;"
		></div>
	</div>
{/if}

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
	.phase-seg:last-child .phase-tip {
		left: auto;
		right: 0;
		transform: none;
	}
	.phase-seg:first-child .phase-tip {
		left: 0;
		transform: none;
	}
</style>
