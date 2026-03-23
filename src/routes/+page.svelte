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
	import TrainingPolarization from '../components/TrainingPolarization.svelte';
	import WeeklyVolume from '../components/WeeklyVolume.svelte';
	import ActivityFeed from '../components/ActivityFeed.svelte';
	import ShoeTracker from '../components/ShoeTracker.svelte';
	import UpcomingCard from '../components/UpcomingCard.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Heartbeat from 'phosphor-svelte/lib/Heartbeat';
	import Lightning from 'phosphor-svelte/lib/Lightning';
	import ListBullets from 'phosphor-svelte/lib/ListBullets';

	let { data }: { data: { dashboard: DashboardData | null } } = $props();
	const d = $derived(data.dashboard);
</script>

<header class="sticky top-0 z-40 border-b border-card-border bg-bg/90 px-6 py-3 backdrop-blur">
	<div class="mx-auto flex max-w-[1400px] items-center justify-between">
		<h1 class="flex items-center gap-2 text-lg font-semibold tracking-tight">
			<img src={favicon} alt="" width="24" height="24" class="rounded-md" />
			<span class="font-mono font-bold bg-gradient-to-r from-status-green to-load-aero-high bg-clip-text text-transparent">Training</span>
		</h1>
		<SyncButton lastSyncedAt={d?.lastSyncedAt ?? null} />
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
	<main class="mx-auto max-w-[1400px] p-4 md:p-6">
	<div class="grid gap-4">

		<!-- ═══ BANNER ═══ -->
		<StatusBanner status={d.currentStatus} readiness={d.readiness} daysSinceLastRun={d.daysSinceLastRun} />

		<!-- ═══ UPCOMING ═══ -->
		{#if d.calendar.length > 0 || d.activities.length > 0}
			<UpcomingCard calendar={d.calendar} activities={d.activities} />
		{/if}

		<!-- ═══ PROFILE: What kind of runner am I? ═══ -->
		<Tip text={`Calibrated for a ${PROFILE_LABEL}.\nAll axes: 0 = average untrained, 100 = elite (top 0.1%).\nDashed blue = 3-month peak · Dashed red = 3-month low.`}>
			<h2 class="mt-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><PersonSimpleRun size={14} weight="bold" /> Runner Profile</h2>
		</Tip>
		<div class="grid gap-4 md:grid-cols-[1fr_2fr]">
			<RunnerProfile
				hillScore={d.hillScore}
				currentStatus={d.currentStatus}
				enduranceScore={d.enduranceScore}
				vo2max={d.currentStatus.vo2max_precise}
				racePredictions={d.racePredictions}
				statusHistory={d.statusHistory}
				hillScoreHistory={d.hillScoreHistory}
				enduranceScoreHistory={d.enduranceScoreHistory}
			/>
			<ProfileTrend
				statusHistory={d.statusHistory}
				hillScoreHistory={d.hillScoreHistory}
				enduranceScoreHistory={d.enduranceScoreHistory}
			/>
		</div>

		<ProfileStats predictions={d.racePredictions} records={d.records} />

		<!-- ═══ BODY: How am I right now? ═══ -->
		<Tip text={"Your current physical state.\nChanges daily based on sleep, stress, and recovery.\nAnswers: can I train today?"}>
			<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Heartbeat size={14} weight="bold" /> Body</h2>
		</Tip>

		<div class="grid gap-4 md:grid-cols-[1fr_2fr]">
			<RecoveryStrip
				bodyBattery={d.bodyBattery}
				stress={d.stress}
				sleepScores={d.sleepScoreHistory}
				heartRate={d.heartRateHistory}
			/>
			<ReadinessGauge readiness={d.readiness} />
		</div>

		<!-- ═══ TRAINING: How is my training going? ═══ -->
		<Tip text={"Your training load, balance, and trends over weeks.\nAnswers: am I training the right amount and mix?"}>
			<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Lightning size={14} weight="bold" /> Training</h2>
		</Tip>

		<div class="grid gap-4 md:grid-cols-2">
			<LoadBalanceChart status={d.currentStatus} />
			<TrainingPolarization activities={d.activities} hrZones={d.hrZones} />
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<AcwrChart history={d.statusHistory} />
			<HrvChart hrv={d.hrvHistory} />
		</div>

		<WeeklyVolume activities={d.activities} />

		<!-- ═══ LOG ═══ -->
		<h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ListBullets size={14} weight="bold" /> Activity Log</h2>

		<ActivityFeed activities={d.activities} hrZones={d.hrZones} />

		<ShoeTracker gear={d.gear} />
	</div>
	</main>
{/if}
