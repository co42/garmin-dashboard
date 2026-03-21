<script lang="ts">
	import type { DashboardData, LactateThreshold } from '$lib/types.js';
	import { generateAdvice } from '$lib/advice.js';
	import StatusBanner from '../components/StatusBanner.svelte';
	import ReadinessGauge from '../components/ReadinessGauge.svelte';
	import LoadBalanceChart from '../components/LoadBalanceChart.svelte';
	import CoachingCard from '../components/CoachingCard.svelte';
	import AcwrChart from '../components/AcwrChart.svelte';
	import HrvChart from '../components/HrvChart.svelte';
	import MetricCard from '../components/MetricCard.svelte';
	import RacePredictions from '../components/RacePredictions.svelte';
	import ActivityFeed from '../components/ActivityFeed.svelte';

	let { data }: { data: DashboardData } = $props();

	const advice = $derived(generateAdvice(data));

	function classifyEndurance(classification: number): string {
		const labels: Record<number, string> = {
			0: 'Beginner',
			1: 'Intermediate',
			2: 'Trained',
			3: 'Well-Trained',
			4: 'Well-Trained',
			5: 'Expert',
			6: 'Superior',
			7: 'Elite',
		};
		return labels[classification] ?? 'Unknown';
	}

	function getLactateHr(lt: LactateThreshold[]): number | null {
		for (const entry of lt) {
			if (entry.hearRate != null) return entry.hearRate;
		}
		return null;
	}
</script>

<div class="grid gap-4">
	<!-- Row 1: Status Banner -->
	<StatusBanner
		status={data.trainingStatus.status}
		vo2max={data.trainingStatus.vo2max}
		daysSinceLastRun={data.daysSinceLastRun}
	/>

	<!-- Row 2: Readiness + Load Balance + Coaching -->
	<div class="grid gap-4 md:grid-cols-3">
		<ReadinessGauge readiness={data.readiness} />
		<LoadBalanceChart loadBalance={data.trainingStatus.loadBalance} />
		<CoachingCard {advice} />
	</div>

	<!-- Row 3: ACWR Trend + HRV Trend -->
	<div class="grid gap-4 md:grid-cols-[2fr_1fr]">
		<AcwrChart status={data.trainingStatus.status} />
		<HrvChart hrv={data.hrv} />
	</div>

	<!-- Row 4: Metric Cards + Race Predictions -->
	<div class="grid gap-4 md:grid-cols-4">
		<MetricCard
			label="VO2max"
			value={data.trainingStatus.vo2max.vo2MaxPreciseValue.toFixed(1)}
			subtitle="mL/kg/min"
			trend={data.trainingStatus.status.fitnessTrend}
		/>
		<MetricCard
			label="Endurance"
			value={data.enduranceScore.overallScore.toLocaleString()}
			subtitle={classifyEndurance(data.enduranceScore.classification)}
		/>
		<MetricCard
			label="Fitness Age"
			value={data.fitnessAge.fitnessAge.toFixed(1)}
			subtitle={`Real age ${data.fitnessAge.chronologicalAge}`}
			delta={data.fitnessAge.fitnessAge - data.fitnessAge.chronologicalAge}
		/>
		<RacePredictions predictions={data.racePredictions} />
	</div>

	<!-- Row 5: Activity Feed -->
	<ActivityFeed
		activities={data.activities}
		lactateHr={getLactateHr(data.lactateThreshold)}
	/>
</div>
