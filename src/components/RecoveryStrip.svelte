<script lang="ts">
	import type { BodyBattery, StressDay, SleepScoreDay, HeartRateDay } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import Tip from './Tip.svelte';

	interface Props {
		bodyBattery: BodyBattery;
		stress: StressDay;
		sleepScores: SleepScoreDay[];
		heartRate: HeartRateDay[];
	}

	let { bodyBattery, stress, sleepScores, heartRate }: Props = $props();

	const latestSleep = $derived(sleepScores.length > 0 ? sleepScores[sleepScores.length - 1] : null);
	const latestHr = $derived(heartRate.length > 0 ? heartRate[heartRate.length - 1] : null);

	function bbColor(val: number): string {
		if (val >= 76) return C.green;
		if (val >= 51) return C.teal;  // yellow-green
		if (val >= 26) return C.orange;
		return C.red;
	}

	function sleepColor(score: number): string {
		if (score >= 90) return C.purple;
		if (score >= 80) return C.green;
		if (score >= 60) return C.amber;
		return C.red;
	}

	function stressLabel(avg: number): { text: string; color: string } {
		if (avg <= 25) return { text: 'Rest', color: C.blue };
		if (avg <= 50) return { text: 'Low', color: C.amber };
		if (avg <= 75) return { text: 'Medium', color: C.orange };
		return { text: 'High', color: C.red };
	}

	function rhrTrend(): string {
		if (heartRate.length < 3) return '';
		const recent = heartRate.slice(-3);
		const older = heartRate.slice(-7, -3);
		if (older.length === 0) return '';
		const recentAvg = recent.reduce((s, x) => s + x.resting_hr, 0) / recent.length;
		const olderAvg = older.reduce((s, x) => s + x.resting_hr, 0) / older.length;
		if (recentAvg < olderAvg - 1) return '↓';
		if (recentAvg > olderAvg + 1) return '↑';
		return '→';
	}
</script>

<div class="grid grid-cols-2 gap-3 h-full">
	<div class="rounded-lg bg-card px-3 md:px-4 py-2 md:py-3 flex flex-col justify-center">
		<Tip text={"Garmin's energy reserve (0–100).\nDrains with activity and stress.\nRecharges with rest and sleep.\n\n< 25 = skip training\n> 60 = green light for hard efforts"}>
			<span class="text-[10px] font-medium uppercase text-text-dim">Body Battery</span>
		</Tip>
		<p class="num text-xl font-bold" style="color: {bbColor(bodyBattery.body_battery_latest)}">{bodyBattery.body_battery_latest}%</p>
		<p class="num text-[10px] text-text-dim">{bodyBattery.body_battery_low}–{bodyBattery.body_battery_high}% today</p>
	</div>

	{#if latestSleep}
		<div class="rounded-lg bg-card px-3 md:px-4 py-2 md:py-3 flex flex-col justify-center">
			<Tip text={"Sleep quality (0–100).\n\n80+ = good\n60–79 = okay\n< 60 = poor — recovery compromised"}>
				<span class="text-[10px] font-medium uppercase text-text-dim">Sleep Score</span>
			</Tip>
				<p class="num text-xl font-bold" style="color: {sleepColor(latestSleep.score)}">{latestSleep.score}%</p>
			<p class="num text-[10px] text-text-dim">{new Date(latestSleep.date.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC' })}</p>
		</div>
	{/if}

	{#if latestHr}
		<div class="rounded-lg bg-card px-3 md:px-4 py-2 md:py-3 flex flex-col justify-center">
			<Tip text={"Heart rate at complete rest.\nLower = fitter.\n\n↓ over weeks = improving fitness\nSudden spike = illness or overtraining"}>
				<span class="text-[10px] font-medium uppercase text-text-dim">Resting HR</span>
			</Tip>
			<p class="num text-xl font-bold text-text">{latestHr.resting_hr} <span class="text-sm text-text-dim">{rhrTrend()}</span></p>
			<p class="num text-[10px] text-text-dim">7d avg {latestHr.avg_7day_resting}</p>
		</div>
	{/if}

	{#if stress.avg_stress > 0}
		{@const sl = stressLabel(stress.avg_stress)}
		<div class="rounded-lg bg-card px-3 md:px-4 py-2 md:py-3 flex flex-col justify-center">
			<Tip text={"All-day stress (0–100) from HRV.\n\n≤ 25 = low (ideal)\n26–50 = medium\n> 50 = high — impairs recovery"}>
				<span class="text-[10px] font-medium uppercase text-text-dim">Stress</span>
			</Tip>
			<p class="num text-xl font-bold" style="color: {sl.color}">{stress.avg_stress}</p>
			<p class="text-[10px] font-medium" style="color: {sl.color}">{sl.text}</p>
		</div>
	{/if}
</div>
