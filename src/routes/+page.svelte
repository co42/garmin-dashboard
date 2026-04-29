<script lang="ts">
	import type { DashboardData } from '$lib/types.js';
	import { computeAge, computeTrendSeries, AXIS_COLORS } from '$lib/profile.js';
	import Tip from '../components/Tip.svelte';
	import SyncButton from '../components/SyncButton.svelte';
	import StatusBanner from '../components/StatusBanner.svelte';
	import RecoveryStrip from '../components/RecoveryStrip.svelte';
	import ReadinessGauge from '../components/ReadinessGauge.svelte';
	import LoadBalanceChart from '../components/LoadBalanceChart.svelte';
	import AcwrChart from '../components/AcwrChart.svelte';
	import HrvChart from '../components/HrvChart.svelte';
	import RunnerProfile from '../components/RunnerProfile.svelte';

	import TrendCard from '../components/TrendCard.svelte';
	import ProfileStats from '../components/ProfileStats.svelte';
	import WeeklyVolume from '../components/WeeklyVolume.svelte';
	import LactateThresholdChart from '../components/LactateThresholdChart.svelte';
	import ActivityFeed from '../components/ActivityFeed.svelte';
	import CourseFeed from '../components/CourseFeed.svelte';
	import ShoeTracker from '../components/ShoeTracker.svelte';
	import UpcomingCard from '../components/UpcomingCard.svelte';
	import EventsList from '../components/EventsList.svelte';
	import PlanSummaryCard from '../components/PlanSummaryCard.svelte';
	import ProjectionChart from '../components/ProjectionChart.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Heartbeat from 'phosphor-svelte/lib/Heartbeat';
	import Lightning from 'phosphor-svelte/lib/Lightning';
	import ListBullets from 'phosphor-svelte/lib/ListBullets';
	import Path from 'phosphor-svelte/lib/Path';
	import Strategy from 'phosphor-svelte/lib/Strategy';

	let { data }: { data: { dashboard: DashboardData | null } } = $props();
	const d = $derived(data.dashboard);
	let feedRef: ActivityFeed | undefined = $state();
	let courseFeedRef: CourseFeed | undefined = $state();

	// Global time window: 4 weeks (1M) or 13 weeks (3M), always starts on a Monday
	let windowWeeks = $state(4);
	const windowStart = $derived(() => {
		const now = new Date();
		const day = now.getUTCDay();
		// Find this week's Monday
		const monday = new Date(now);
		monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
		// Go back N weeks from this Monday
		monday.setUTCDate(monday.getUTCDate() - (windowWeeks * 7));
		return monday.toISOString().slice(0, 10);
	});

	// Daily points (1M) vs Monday-bucketed weekly points (3M, 1Y)
	const granularity = $derived(windowWeeks >= 13 ? 'week' : 'day');

	// An active plan is one that is not finished/paused/cancelled. Whitelist
	// of known dead statuses — more forgiving than matching the single
	// observed active value ("Scheduled").
	const DEAD_STATUSES = new Set(['Completed', 'Paused', 'Cancelled']);
	function planIsActive(dash: DashboardData): boolean {
		if (!dash.coachPlan || !dash.coachEvent) return false;
		return !DEAD_STATUSES.has(dash.coachPlan.training_status ?? '');
	}

	// Lactate threshold pace string formatted from speed_mps
	function ltPaceStr(dash: DashboardData): string | null {
		const speed = dash.userSettings?.lactate_threshold_speed_mps ?? dash.lactateThreshold.speed_mps ?? null;
		if (!speed) return null;
		const spk = Math.round(1000 / speed);
		return `${Math.floor(spk / 60)}:${String(spk % 60).padStart(2, '0')}`;
	}

	// Windowed slices for all time-series components.
	// `activities` is run-only (Weekly Volume / load deconvolution want km from
	// runs, not strength sessions) but covers all running variants: road, trail,
	// treadmill, track. The full mixed-type list lives on `dash.activities` for
	// the calendar + activity log.
	function filterWindow(dash: DashboardData) {
		const start = windowStart();
		return {
			status: dash.statusHistory.filter(s => s.date >= start),
			hrv: dash.hrvHistory.filter(h => h.date >= start),
			heartRate: dash.heartRateHistory.filter(h => h.date >= start),
			sleep: dash.sleepScoreHistory.filter(s => s.date >= start),
			hillScore: dash.hillScoreHistory.filter(h => h.date >= start),
			endurance: dash.enduranceScoreHistory.filter(e => e.date >= start),
			activities: dash.activities.filter(a => a.activity_type.endsWith('running') && a.start_time_local.slice(0, 10) >= start),
		};
	}
</script>

<header class="fixed top-0 left-0 right-0 z-40 border-b border-card-border bg-bg/90 px-3 md:px-6 py-3 backdrop-blur">
	<div class="mx-auto flex max-w-[1400px] items-center justify-between">
		<h1 class="flex items-center gap-2 text-lg font-semibold tracking-tight">
			<img src={favicon} alt="" width="24" height="24" class="rounded-md" />
			<span class="font-mono font-bold bg-gradient-to-r from-status-green to-load-aero-high bg-clip-text text-transparent">Training</span>
		</h1>
		<div class="flex items-center gap-3">
			<div class="flex rounded-md border border-card-border text-xs font-mono font-medium divide-x divide-card-border">
				<button
					class="cursor-pointer px-2.5 py-1 rounded-l-md transition-colors {windowWeeks === 4 ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => windowWeeks = 4}
				>1M</button>
				<button
					class="cursor-pointer px-2.5 py-1 transition-colors {windowWeeks === 13 ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => windowWeeks = 13}
				>3M</button>
				<button
					class="cursor-pointer px-2.5 py-1 rounded-r-md transition-colors {windowWeeks === 52 ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => windowWeeks = 52}
				>1Y</button>
			</div>
			<SyncButton lastSyncedAt={d?.lastSyncedAt ?? null} />
		</div>
	</div>
</header>

{#if !d}
	<div class="flex flex-col items-center justify-center gap-6 py-24 pt-[calc(3rem+24px)]">
		<div class="text-center">
			<h2 class="text-2xl font-bold text-text">No data yet</h2>
			<p class="mt-2 text-text-secondary">Click sync to pull your Garmin data.</p>
		</div>
	</div>
{:else}
	{@const w = filterWindow(d)}
	<main class="mx-auto max-w-[1400px] p-3 md:p-6 pt-[calc(3rem+24px)] md:pt-[calc(3rem+24px)] overflow-x-hidden">
	<div class="grid gap-4 min-w-0">

		<!-- ═══ BANNER ═══ -->
		<StatusBanner status={d.currentStatus} statusHistory={w.status} readiness={d.readiness} daysSinceLastRun={d.daysSinceLastRun} />

		<!-- ═══ CALENDAR: upcoming workouts and events ═══ -->
		{#if d.calendar.length > 0 || d.activities.length > 0}
			<UpcomingCard calendar={d.calendar} activities={d.activities} splits={d.recentSplits} hrZones={d.hrZones} activityWeather={d.activityWeather} onNavigate={(id) => feedRef?.navigateTo(id)} />
		{/if}

		<!-- ═══ EVENTS: full upcoming race calendar (independent of week navigation) ═══ -->
		{#if d.events.length > 0}
			<EventsList events={d.events} courses={d.courses} onNavigateCourse={(id) => courseFeedRef?.navigateTo(id)} />
		{/if}

		<!-- ═══ COACH: active adaptive training plan & race projection ═══ -->
		{#if planIsActive(d)}
			<Tip text={"Your active Garmin adaptive plan and race-time projection.\nAnswers: am I on track for my target event?"}>
				<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Strategy size={14} weight="bold" /> Coach</h2>
			</Tip>

			{#key windowWeeks}
			<div class="grid gap-4 md:grid-cols-2">
				<PlanSummaryCard
					plan={d.coachPlan!}
					event={d.coachEvent!}
					today={d.projectionHistory.at(-1) ?? null}
				/>
				<ProjectionChart
					history={d.projectionHistory}
					event={d.coachEvent!}
					planStartDate={d.coachPlan?.start_date ?? null}
				/>
			</div>
			{/key}
		{/if}

		<!-- ═══ PROFILE: What kind of runner am I? ═══ -->
		<Tip text={`Calibrated for a ${computeAge(d.userSettings?.birth_date)}yo ${d.userSettings?.gender ?? 'male'}.\nAll axes: 0 = untrained, 100 = elite.`}>
			<h2 class="mt-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><PersonSimpleRun size={14} weight="bold" /> Runner Profile</h2>
		</Tip>
		{#key windowWeeks}
		{@const trend = computeTrendSeries(w.status, w.hillScore, w.endurance, granularity)}
		<div class="grid gap-4 md:grid-cols-2">
			<RunnerProfile
				hillScore={d.hillScore}
				currentStatus={d.currentStatus}
				enduranceScore={d.enduranceScore}
				vo2max={d.currentStatus.vo2max}
				statusHistory={w.status}
				fullStatusHistory={d.statusHistory}
				hillScoreHistory={w.hillScore}
				enduranceScoreHistory={w.endurance}
				userSettings={d.userSettings}
			/>
			<TrendCard
				title="VO2max"
				tip="Raw VO2max over time. Y-axis auto-scales to the data range."
				rawKey="vo2max"
				interval={1}
				labels={trend.labels}
				series={[{ name: 'VO2max', color: AXIS_COLORS.vo2max, values: trend.vo2max }]}
			/>
			<TrendCard
				title="Endurance"
				tip="Raw endurance score over time. Y-axis auto-scales to the data range."
				rawKey="endurance"
				interval={100}
				labels={trend.labels}
				series={[{ name: 'Endurance', color: AXIS_COLORS.endurance, values: trend.endurance }]}
			/>
			<TrendCard
				title="Hill"
				tip="Garmin Hill score (overall climbing ability — combines Str, End and VO2max).\nSub-scores Str (power on steep climbs) and End (sustained climbing) shown for context. 0–100 each."
				rawKey="hill"
				interval={5}
				labels={trend.labels}
				series={[
					{ name: 'Hill', color: AXIS_COLORS.hill, values: trend.hill },
					{ name: 'Str', color: AXIS_COLORS.hillStr, values: trend.hillStr },
					{ name: 'End', color: AXIS_COLORS.hillEnd, values: trend.hillEnd },
				]}
			/>
		</div>
		{/key}

		<!-- ═══ TRAINING: How is my training going? ═══ -->
		<Tip text={"Your training load, balance, and trends over weeks.\nAnswers: am I training the right amount and mix?"}>
			<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Lightning size={14} weight="bold" /> Training</h2>
		</Tip>

		{#key windowWeeks}
		<div class="grid gap-4 md:grid-cols-2">
			<LoadBalanceChart status={d.currentStatus} statusHistory={d.statusHistory} activities={d.activities} hrZones={d.hrZones} maxHr={d.userSettings?.max_hr_bpm ?? null} lactateHr={d.userSettings?.lactate_threshold_hr_bpm ?? d.lactateThreshold.heart_rate ?? null} lactatePace={ltPaceStr(d)} />
			<AcwrChart history={w.status} granularity={granularity} />
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<WeeklyVolume activities={w.activities} hrZones={d.hrZones} maxHr={d.userSettings?.max_hr_bpm ?? null} windowStart={windowStart()} />
			<LactateThresholdChart history={d.lactateThresholdHistory} windowStart={windowStart()} />
		</div>
		{/key}

		{#key windowWeeks}
		<ProfileStats predictions={d.racePredictions} records={d.records} activities={d.activities} history={d.racePredictionHistory.filter(r => r.date >= windowStart())} onNavigate={(id) => feedRef?.navigateTo(id)} />
		{/key}

		<!-- ═══ BODY: How am I right now? ═══ -->
		<Tip text={"Your current physical state.\nChanges daily based on sleep, stress, and recovery.\nAnswers: can I train today?"}>
			<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Heartbeat size={14} weight="bold" /> Body</h2>
		</Tip>

		<div class="grid gap-4 sm:grid-cols-3">
			<RecoveryStrip
				bodyBattery={d.bodyBattery}
				stress={d.stress}
				sleepScores={w.sleep}
				heartRate={w.heartRate}
			/>
			<ReadinessGauge readiness={d.readiness} />
			<HrvChart hrv={w.hrv} />
		</div>

		<!-- ═══ LOG ═══ -->
		<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ListBullets size={14} weight="bold" /> Activity Log</h2>

		<ActivityFeed bind:this={feedRef} activities={d.activities} splits={d.recentSplits} details={d.activityDetails} weather={d.activityWeather} hrZones={d.hrZones} />

		<!-- ═══ COURSES ═══ -->
		{#if d.courses.length > 0}
			<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Path size={14} weight="bold" /> Courses</h2>
			<CourseFeed bind:this={courseFeedRef} courses={d.courses} />
		{/if}

		<ShoeTracker gear={d.gear} />
	</div>
	</main>
{/if}
