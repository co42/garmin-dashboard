<script lang="ts">
	import type { DashboardData } from '$lib/types.js';
	import { PROFILE_LABEL } from '$lib/profile.js';
	import Tip from '../components/Tip.svelte';
	import SyncButton from '../components/SyncButton.svelte';
	import StatusBanner from '../components/StatusBanner.svelte';
	import RecoveryStrip from '../components/RecoveryStrip.svelte';
	import ReadinessGauge from '../components/ReadinessGauge.svelte';
	import LoadBalanceChart from '../components/LoadBalanceChart.svelte';
	import AcwrChart from '../components/AcwrChart.svelte';
	import HrvChart from '../components/HrvChart.svelte';
	import RunnerProfile from '../components/RunnerProfile.svelte';

	import ProfileTrend from '../components/ProfileTrend.svelte';
	import ProfileStats from '../components/ProfileStats.svelte';
	import WeeklyVolume from '../components/WeeklyVolume.svelte';
	import ActivityFeed from '../components/ActivityFeed.svelte';
	import CourseFeed from '../components/CourseFeed.svelte';
	import ShoeTracker from '../components/ShoeTracker.svelte';
	import UpcomingCard from '../components/UpcomingCard.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Heartbeat from 'phosphor-svelte/lib/Heartbeat';
	import Lightning from 'phosphor-svelte/lib/Lightning';
	import ListBullets from 'phosphor-svelte/lib/ListBullets';
	import Path from 'phosphor-svelte/lib/Path';

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

	// Fixed 13-week window for Weekly Volume (independent of 1M/3M toggle)
	const volumeStart = $derived(() => {
		const now = new Date();
		const day = now.getUTCDay();
		const monday = new Date(now);
		monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
		monday.setUTCDate(monday.getUTCDate() - (13 * 7));
		return monday.toISOString().slice(0, 10);
	});

	// Windowed slices for all time-series components
	function filterWindow(dash: DashboardData) {
		const start = windowStart();
		return {
			status: dash.statusHistory.filter(s => s.date >= start),
			hrv: dash.hrvHistory.filter(h => h.date >= start),
			heartRate: dash.heartRateHistory.filter(h => h.date >= start),
			sleep: dash.sleepScoreHistory.filter(s => s.date >= start),
			hillScore: dash.hillScoreHistory.filter(h => h.date >= start),
			endurance: dash.enduranceScoreHistory.filter(e => e.date >= start),
			activities: dash.activities.filter(a => a.start_time.slice(0, 10) >= start),
		};
	}
</script>

<header class="sticky top-0 z-40 border-b border-card-border bg-bg/90 px-3 md:px-6 py-3 backdrop-blur">
	<div class="mx-auto flex max-w-[1400px] items-center justify-between">
		<h1 class="flex items-center gap-2 text-lg font-semibold tracking-tight">
			<img src={favicon} alt="" width="24" height="24" class="rounded-md" />
			<span class="font-mono font-bold bg-gradient-to-r from-status-green to-load-aero-high bg-clip-text text-transparent">Training</span>
		</h1>
		<div class="flex items-center gap-3">
			<div class="flex rounded-md border border-card-border text-xs font-mono font-medium">
				<button
					class="cursor-pointer px-2.5 py-1 rounded-l-md transition-colors {windowWeeks === 4 ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => windowWeeks = 4}
				>1M</button>
				<button
					class="cursor-pointer px-2.5 py-1 rounded-r-md transition-colors {windowWeeks === 13 ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => windowWeeks = 13}
				>3M</button>
			</div>
			<SyncButton lastSyncedAt={d?.lastSyncedAt ?? null} />
		</div>
	</div>
</header>

{#if !d}
	<div class="flex flex-col items-center justify-center gap-6 py-24">
		<div class="text-center">
			<h2 class="text-2xl font-bold text-text">No data yet</h2>
			<p class="mt-2 text-text-secondary">Click sync to pull your Garmin data.</p>
		</div>
	</div>
{:else}
	{@const w = filterWindow(d)}
	<main class="mx-auto max-w-[1400px] p-3 md:p-6 overflow-x-hidden">
	<div class="grid gap-4 min-w-0">

		<!-- ═══ BANNER ═══ -->
		<StatusBanner status={d.currentStatus} statusHistory={w.status} readiness={d.readiness} daysSinceLastRun={d.daysSinceLastRun} />

		<!-- ═══ UPCOMING ═══ -->
		{#if d.calendar.length > 0 || d.activities.length > 0}
			<UpcomingCard calendar={d.calendar} activities={d.activities} splits={d.recentSplits} courses={d.courses} hrZones={d.hrZones} activityWeather={d.activityWeather} onNavigate={(id) => feedRef?.navigateTo(id)} onNavigateCourse={(id) => courseFeedRef?.navigateTo(id)} />
		{/if}

		<!-- ═══ PROFILE: What kind of runner am I? ═══ -->
		<Tip text={`Calibrated for a ${PROFILE_LABEL}.\nAll axes: 0 = average untrained, 100 = elite (top 0.1%).\nDashed blue = 3-month peak · Dashed red = 3-month low.`}>
			<h2 class="mt-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><PersonSimpleRun size={14} weight="bold" /> Runner Profile</h2>
		</Tip>
		{#key windowWeeks}
		<div class="grid gap-4 md:grid-cols-[1fr_2fr]">
			<RunnerProfile
				hillScore={d.hillScore}
				currentStatus={d.currentStatus}
				enduranceScore={d.enduranceScore}
				vo2max={d.currentStatus.vo2max_precise}
				statusHistory={w.status}
				fullStatusHistory={d.statusHistory}
				hillScoreHistory={w.hillScore}
				enduranceScoreHistory={w.endurance}
			/>
			<ProfileTrend
				statusHistory={w.status}
				hillScoreHistory={w.hillScore}
				enduranceScoreHistory={w.endurance}
			/>
		</div>
		{/key}

		<!-- ═══ TRAINING: How is my training going? ═══ -->
		<Tip text={"Your training load, balance, and trends over weeks.\nAnswers: am I training the right amount and mix?"}>
			<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Lightning size={14} weight="bold" /> Training</h2>
		</Tip>

		{#key windowWeeks}
		<div class="grid gap-4 md:grid-cols-2">
			<LoadBalanceChart status={d.currentStatus} statusHistory={d.statusHistory} activities={d.activities} hrZones={d.hrZones} maxHr={d.userSettings?.max_hr ?? null} lactateHr={d.userSettings?.lactate_threshold_hr ?? d.lactateThreshold.heart_rate ?? null} lactatePace={d.lactateThreshold.pace ?? null} />
			<AcwrChart history={w.status} />
		</div>

		<WeeklyVolume activities={d.activities.filter(a => a.start_time.slice(0, 10) >= volumeStart())} hrZones={d.hrZones} maxHr={d.userSettings?.max_hr ?? null} />
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
