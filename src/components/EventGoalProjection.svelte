<script lang="ts">
	import type { EventProjection, RaceEvent } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import { daysBetween } from '$lib/dates.js';
	import { todayStore } from '$lib/today.svelte.js';
	import { formatTime } from '$lib/format.js';

	interface Props {
		event: RaceEvent;
		// Latest entry of the per-event projection history (drives the
		// Current/Projection split). Pass null when there's no history — we
		// fall back to the event's static fields.
		latest: EventProjection | null;
	}

	let { event, latest }: Props = $props();

	const todayStr = $derived(todayStore.current);

	function paceMSSPerKm(secs: number, meters: number): string {
		const spk = Math.round(secs / (meters / 1000));
		return `${Math.floor(spk / 60)}:${String(spk % 60).padStart(2, '0')}/km`;
	}

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

	// Age of the latest projection — surfaced as a relative-time badge so a
	// stale projection (e.g. a week-old sync) is obvious at a glance.
	const projAge = $derived(latest ? daysBetween(latest.date, todayStr) : null);
	const projAgeLabel = $derived(
		projAge == null ? null
			: projAge === 0 ? 'TODAY'
			: projAge === 1 ? '1d AGO'
			: `${projAge}d AGO`
	);
	const projAgeColor = $derived(projAge === 0 ? C.green : C.orange);

	// Prefer history values (more accurate per-day) and fall back to the
	// event's static snapshot fields when no history was synced for this event.
	const curTime = $derived(latest?.predicted_race_time_seconds ?? event.predicted_race_time_seconds ?? null);
	const projTime = $derived(latest?.projection_race_time_seconds ?? event.projected_race_time_seconds ?? null);
	const curTimeDelta = $derived(timeDeltaVsGoal(curTime));
	const curPaceDelta = $derived(paceDeltaVsGoal(curTime));
	const projTimeDelta = $derived(timeDeltaVsGoal(projTime));
	const projPaceDelta = $derived(paceDeltaVsGoal(projTime));

	const hasGoal = $derived(event.goal_seconds != null);
	const hasProjection = $derived(curTime != null || projTime != null);
</script>

{#if hasGoal || hasProjection}
	<!-- Mobile: 2 cols with Goal spanning the full width on top so Current and
	     Projection share row 2. sm+: 3 cols, all equal. Empty Current /
	     Projection columns are hidden entirely (no "—" placeholder). -->
	<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
		<!-- Goal -->
		<div class="min-w-0 col-span-2 sm:col-span-1">
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
				<p class="num text-xs text-text-dim italic">no goal</p>
			{/if}
		</div>

		<!-- Current (today's fitness baseline). The TODAY/Xd AGO badge sits on
		     this column so a stale projection is obvious at a glance. -->
		{#if curTime != null}
			<div class="min-w-0">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-0.5 flex items-baseline gap-1.5">
					<span>Current</span>
					{#if projAgeLabel}
						<span class="num text-[9px]" style="color: {projAgeColor}">({projAgeLabel})</span>
					{/if}
				</p>
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
			</div>
		{/if}

		<!-- Projection (plan-adjusted forecast at event day) -->
		{#if projTime != null}
			<div class="min-w-0">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-0.5">Projection</p>
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
			</div>
		{/if}
	</div>
{/if}
