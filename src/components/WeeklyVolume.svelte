<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Activity } from '$lib/types.js';
	import { weekMonday, utcDate, fmtDateISO, addDays } from '$lib/dates.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import ChartBar from 'phosphor-svelte/lib/ChartBar';

	interface Props {
		activities: Activity[];
	}

	let { activities }: Props = $props();
	let chartEl: HTMLDivElement;

	const stats = $derived(() => {
		const data = weeklyData();
		const activeWeeks = data.filter(d => d.km > 0);
		const totalKm = data.reduce((s, d) => s + d.km, 0);
		const totalRuns = data.reduce((s, d) => s + d.runs, 0);
		const avgKm = activeWeeks.length > 0 ? totalKm / activeWeeks.length : 0;
		return { totalKm: Math.round(totalKm), totalRuns, avgKm: Math.round(avgKm) };
	});

	const weeklyData = $derived(() => {
		const weeks = new Map<string, { km: number; runs: number }>();
		for (const a of activities) {
			const week = weekMonday(a.start_time);
			const existing = weeks.get(week) ?? { km: 0, runs: 0 };
			existing.km += a.distance_meters / 1000;
			existing.runs++;
			weeks.set(week, existing);
		}

		const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		if (sorted.length === 0) return [];

		// Fill gaps so weeks with 0 runs still show on the chart
		const result: { week: string; km: number; runs: number }[] = [];
		const start = utcDate(sorted[0][0]);
		const end = utcDate(sorted[sorted.length - 1][0]);

		for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
			const key = fmtDateISO(d);
			const data = weeks.get(key) ?? { km: 0, runs: 0 };
			result.push({ week: key, ...data });
		}
		return result;
	});

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		const data = weeklyData();
		const weeks = data.map(d => {
			const dt = utcDate(d.week);
			return `${dt.getUTCDate()} ${dt.toLocaleDateString('en-GB', { month: 'short' })}`;
		});
		const kms = data.map(d => Math.round(d.km * 10) / 10);
		const runs = data.map(d => d.runs);

		_chart.setOption({
			grid: { top: 45, right: 16, bottom: 30, left: 45 },
			legend: { show: false },
			tooltip: { show: false },
			xAxis: {
				type: 'category', data: weeks,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, rotate: 30 },
			},
			yAxis: {
				type: 'value', name: 'km',
				nameTextStyle: { color: C.textDim, fontSize: 10 },
				axisLine: { show: false },
				axisLabel: CHART_AXIS.axisLabel,
				splitLine: CHART_AXIS.splitLine,
			},
			series: [
				{
					type: 'bar',
					name: 'Weekly km',
					data: kms.map((k, i) => ({
						value: k,
						itemStyle: { color: k > 0 ? C.blue : C.hover, borderRadius: [3, 3, 0, 0] },
					})),
					barWidth: '65%',
					label: {
						show: true,
						position: 'top',
						formatter: (params: any) => {
							const i = params.dataIndex;
							const k = kms[i];
							const r = runs[i];
							if (k <= 0) return '';
							return `${r} · ${Math.round(k)}km`;
						},
						color: C.textSecondary,
						fontSize: 9,
						fontFamily: MONO,
					},
				},
				],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4">
	<div class="flex flex-wrap items-center justify-between gap-y-1 mb-2">
		<Tip text={"Weekly running distance over time.\nConsistency matters more than peak weeks.\n\nAim for ≤ 10% increase week-over-week.\nGaps (0 km weeks) directly cause ACWR to drop."}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartBar size={14} weight="bold" /> Weekly Volume</h2>
		</Tip>
		<div class="flex items-center gap-3 text-[10px] num">
			<span class="text-text-secondary"><b class="text-text">{stats().totalRuns}</b> runs</span>
			<span class="text-text-secondary"><b class="text-text">{stats().totalKm}</b> km</span>
			<span class="text-text-secondary">avg <b class="text-text">{stats().avgKm}</b> km/wk</span>
		</div>
	</div>
	<div bind:this={chartEl} class="h-[200px] w-full"></div>
</div>
