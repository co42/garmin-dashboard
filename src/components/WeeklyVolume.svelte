<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Activity } from '$lib/types.js';
	import Tip from './Tip.svelte';

	interface Props {
		activities: Activity[];
	}

	let { activities }: Props = $props();
	let chartEl: HTMLDivElement;

	function getWeekKey(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		const day = d.getDay();
		d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	const weeklyData = $derived(() => {
		const weeks = new Map<string, { km: number; runs: number }>();
		for (const a of activities) {
			const week = getWeekKey(a.start_time);
			const existing = weeks.get(week) ?? { km: 0, runs: 0 };
			existing.km += a.distance_meters / 1000;
			existing.runs++;
			weeks.set(week, existing);
		}

		const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		if (sorted.length === 0) return [];

		const result: { week: string; km: number; runs: number }[] = [];
		const start = new Date(sorted[0][0]);
		const end = new Date(sorted[sorted.length - 1][0]);

		for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
			const key = d.toISOString().slice(0, 10);
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
		const weeks = data.map(d => new Date(d.week + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
		const kms = data.map(d => Math.round(d.km * 10) / 10);
		const runs = data.map(d => d.runs);

		const nonZeroKms = kms.filter(k => k > 0);
		const avgKm = nonZeroKms.length > 0 ? nonZeroKms.reduce((s, v) => s + v, 0) / nonZeroKms.length : 0;

		_chart.setOption({
			grid: { top: 35, right: 16, bottom: 30, left: 45 },
			legend: { show: false },
			tooltip: {
				trigger: 'axis', confine: true, backgroundColor: '#1e1e2a', borderColor: '#2a2a3a',
				textStyle: { color: '#e8e8ed', fontSize: 12 },
				formatter: (params: any) => {
					const p = params[0];
					return `${p.name}<br/>Distance: <b>${p.value} km</b><br/>Runs: ${runs[p.dataIndex]}`;
				},
			},
			xAxis: {
				type: 'category', data: weeks,
				axisLine: { lineStyle: { color: '#2a2a3a' } },
				axisLabel: { color: '#555568', fontSize: 10, rotate: 30 },
			},
			yAxis: {
				type: 'value', name: 'km',
				nameTextStyle: { color: '#555568', fontSize: 10 },
				axisLine: { show: false },
				axisLabel: { color: '#555568', fontSize: 10 },
				splitLine: { lineStyle: { color: '#1e1e2a' } },
			},
			series: [
				{
					type: 'bar',
					name: 'Weekly km',
					data: kms.map(k => ({
						value: k,
						itemStyle: { color: k > 0 ? '#3b82f6' : '#1e1e2a', borderRadius: [3, 3, 0, 0] },
					})),
					barWidth: '65%',
				},
				{
					type: 'line',
					name: `Avg ${Math.round(avgKm)} km`,
					data: kms.map(() => Math.round(avgKm * 10) / 10),
					symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: '#555568' },
					tooltip: { show: false },
				},
			],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4">
	<Tip text={"Weekly running distance over time.\nConsistency matters more than peak weeks.\n\nDashed line = your average.\nAim for ≤ 10% increase week-over-week.\nGaps (0 km weeks) directly cause ACWR to drop."}>
		<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">Weekly Volume</h2>
	</Tip>
	<div bind:this={chartEl} class="h-[200px] w-full"></div>
</div>
