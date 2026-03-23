<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { HillScore, DailyTrainingStatus, EnduranceScore, RacePredictions } from '$lib/types.js';
	import { AXES, AXIS_ORDER, normalize, computeBalance, estimate5kFromVo2 } from '$lib/profile.js';
	import { C, CHART_TOOLTIP } from '$lib/colors.js';
	import Tip from './Tip.svelte';

	interface Props {
		hillScore: HillScore;
		currentStatus: DailyTrainingStatus;
		enduranceScore: EnduranceScore;
		vo2max: number;
		racePredictions: RacePredictions;
		statusHistory: DailyTrainingStatus[];
		hillScoreHistory: HillScore[];
		enduranceScoreHistory: EnduranceScore[];
	}

	let { hillScore, currentStatus, enduranceScore, vo2max, racePredictions, statusHistory, hillScoreHistory, enduranceScoreHistory }: Props = $props();

	let radarEl: HTMLDivElement;

	function currentValue(key: string): number {
		switch (key) {
			case 'vo2max': return normalize(key, vo2max);
			case 'speed': return normalize(key, racePredictions.time_5k_seconds);
			case 'endurance': return normalize(key, enduranceScore.score);
			case 'balance': return Math.max(0, computeBalance(currentStatus));
			case 'hillStr': return normalize(key, hillScore.strength);
			case 'hillEnd': return normalize(key, hillScore.endurance);
			default: return 0;
		}
	}

	function rawLabel(key: string): string {
		switch (key) {
			case 'vo2max': return vo2max.toFixed(1);
			case 'speed': return racePredictions.pace_5k + ' /km';
			case 'endurance': return enduranceScore.score.toLocaleString();
			case 'balance': return currentStatus.load_balance_feedback.toLowerCase().replace(/_/g, ' ');
			case 'hillStr': return String(hillScore.strength);
			case 'hillEnd': return String(hillScore.endurance);
			default: return '';
		}
	}

	// Compute 3-month peak per axis from history
	function peakValues(): number[] {
		const peaks: Record<string, number> = {};
		for (const key of AXIS_ORDER) peaks[key] = 0;

		for (const s of statusHistory) {
			const v = s.vo2max_precise > 0 ? s.vo2max_precise : s.vo2max;
			peaks.vo2max = Math.max(peaks.vo2max, normalize('vo2max', v));
			peaks.speed = Math.max(peaks.speed, normalize('speed', estimate5kFromVo2(v)));
			const bal = computeBalance(s);
			if (bal >= 0) peaks.balance = Math.max(peaks.balance, bal);
		}
		for (const h of hillScoreHistory) {
			peaks.hillStr = Math.max(peaks.hillStr, normalize('hillStr', h.strength));
			peaks.hillEnd = Math.max(peaks.hillEnd, normalize('hillEnd', h.endurance));
		}
		for (const e of enduranceScoreHistory) {
			peaks.endurance = Math.max(peaks.endurance, normalize('endurance', e.score));
		}

		return AXIS_ORDER.map(key => peaks[key]);
	}

	// Compute 3-month floor per axis from history
	function floorValues(): number[] {
		const floors: Record<string, number> = {};
		for (const key of AXIS_ORDER) floors[key] = 100;

		for (const s of statusHistory) {
			const v = s.vo2max_precise > 0 ? s.vo2max_precise : s.vo2max;
			floors.vo2max = Math.min(floors.vo2max, normalize('vo2max', v));
			floors.speed = Math.min(floors.speed, normalize('speed', estimate5kFromVo2(v)));
			const bal = computeBalance(s);
			if (bal >= 0) floors.balance = Math.min(floors.balance, bal);
		}
		for (const h of hillScoreHistory) {
			floors.hillStr = Math.min(floors.hillStr, normalize('hillStr', h.strength));
			floors.hillEnd = Math.min(floors.hillEnd, normalize('hillEnd', h.endurance));
		}
		for (const e of enduranceScoreHistory) {
			floors.endurance = Math.min(floors.endurance, normalize('endurance', e.score));
		}

		return AXIS_ORDER.map(key => floors[key]);
	}

	const radarData = $derived(() =>
		AXIS_ORDER.map(key => ({
			key,
			axis: AXES[key].name,
			value: currentValue(key),
			raw: rawLabel(key),
		}))
	);

	let _chart: any;
	let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(radarEl, undefined, { renderer: 'svg' });
		const rd = radarData();
		const peaks = peakValues();
		const floors = floorValues();

		_chart.setOption({
			radar: {
				indicator: rd.map(d => ({ name: d.axis, max: 100 })),
				shape: 'polygon',
				radius: '75%',
				axisName: { color: C.textSecondary, fontSize: 11 },
				axisLine: { lineStyle: { color: C.hover } },
				splitLine: { lineStyle: { color: C.cardBorder } },
				splitArea: { show: false },
			},
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'item',
				formatter: () => rd.map((d, i) => {
					const a = AXES[d.key];
					const rawStr = d.raw ? ` (${d.raw})` : '';
					const range = floors[i] !== peaks[i] ? ` · 3m: ${floors[i]}–${peaks[i]}` : '';
					return `<b>${d.axis}: ${d.value}</b>${rawStr}${range}<br/><span style="color:${C.textDim};font-size:10px">0: ${a.zeroLabel}<br/>100: ${a.hundredLabel}</span>`;
				}).join('<br/><br/>'),
			},
			series: [{
				type: 'radar',
				data: [
					// 3-month floor (background, subtle)
					{
						value: floors,
						name: '3m low',
						areaStyle: { color: 'rgba(239, 68, 68, 0.15)' },
						lineStyle: { color: 'rgba(239, 68, 68, 0.6)', width: 1.5, type: 'dashed' },
						itemStyle: { color: 'rgba(239, 68, 68, 0.6)' },
						symbol: 'circle',
						symbolSize: 3,
						z: 0,
					},
					// 3-month peak (background)
					{
						value: peaks,
						name: '3m peak',
						areaStyle: { color: 'rgba(59, 130, 246, 0.12)' },
						lineStyle: { color: 'rgba(59, 130, 246, 0.5)', width: 1.5, type: 'dashed' },
						itemStyle: { color: 'rgba(59, 130, 246, 0.5)' },
						symbol: 'circle',
						symbolSize: 3,
						z: 1,
					},
					// Current values (foreground)
					{
						value: rd.map(d => d.value),
						name: 'Current',
						areaStyle: { color: 'transparent' },
						lineStyle: { color: C.blue, width: 2 },
						itemStyle: { color: C.blue },
						symbol: 'circle',
						symbolSize: 6,
						z: 2,
					},
				],
			}],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(radarEl);
	});
</script>

<div class="rounded-lg bg-card p-2 h-full">
	<div bind:this={radarEl} class="h-full min-h-[240px] w-full"></div>
</div>
