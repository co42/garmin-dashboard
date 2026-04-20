<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { HillScore, DailyTrainingStatus, EnduranceScore } from '$lib/types.js';
	import { AXES, RADAR_AXIS_ORDER, AXIS_COLORS, normalize, formatRaw, computeBalance, computeProductivity } from '$lib/profile.js';
	import { C, MONO } from '$lib/colors.js';
	import ChartPolar from 'phosphor-svelte/lib/ChartPolar';

	interface Props {
		hillScore: HillScore;
		currentStatus: DailyTrainingStatus;
		enduranceScore: EnduranceScore;
		vo2max: number;
		statusHistory: DailyTrainingStatus[];
		fullStatusHistory: DailyTrainingStatus[];
		hillScoreHistory: HillScore[];
		enduranceScoreHistory: EnduranceScore[];
	}

	let { hillScore, currentStatus, enduranceScore, vo2max, statusHistory, fullStatusHistory, hillScoreHistory, enduranceScoreHistory }: Props = $props();

	let radarEl: HTMLDivElement;
	let axisTip = $state({ visible: false, text: '', x: 0, y: 0 });

	// Rolling 30-day average of balance scores
	function rolling30dBalance(history: DailyTrainingStatus[], atDate?: string): number {
		const cutoff = atDate
			? new Date(new Date(atDate + 'T00:00:00Z').getTime() - 30 * 86400000).toISOString().slice(0, 10)
			: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
		const endDate = atDate ?? new Date().toISOString().slice(0, 10);
		const window = history.filter(s => s.date >= cutoff && s.date <= endDate);
		const scores = window.map(s => computeBalance(s)).filter(b => b >= 0);
		if (scores.length === 0) return 0;
		return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
	}

	function rawValue(key: string): number {
		switch (key) {
			case 'vo2max': return vo2max;
			case 'endurance': return enduranceScore.score;
			case 'balance': return rolling30dBalance(fullStatusHistory);
			case 'hill': return hillScore.overall;
			case 'productivity': return Math.max(0, computeProductivity(fullStatusHistory));
			default: return 0;
		}
	}

	function peakValues(): { norm: number[]; raw: number[] } {
		const peaks: Record<string, number> = {};
		const rawPeaks: Record<string, number> = {};
		for (const key of RADAR_AXIS_ORDER) { peaks[key] = 0; rawPeaks[key] = -Infinity; }

		for (const s of statusHistory) {
			const v = s.vo2max;
			if (normalize('vo2max', v) >= peaks.vo2max) { peaks.vo2max = normalize('vo2max', v); rawPeaks.vo2max = v; }
			const bal = rolling30dBalance(fullStatusHistory, s.date);
			if (bal >= peaks.balance) { peaks.balance = bal; rawPeaks.balance = bal; }
			const prod = computeProductivity(fullStatusHistory, s.date);
			if (prod >= 0 && prod >= peaks.productivity) { peaks.productivity = prod; rawPeaks.productivity = prod; }
		}
		for (const h of hillScoreHistory) {
			if (normalize('hill', h.overall) >= peaks.hill) { peaks.hill = normalize('hill', h.overall); rawPeaks.hill = h.overall; }
		}
		for (const e of enduranceScoreHistory) {
			if (normalize('endurance', e.score) >= peaks.endurance) { peaks.endurance = normalize('endurance', e.score); rawPeaks.endurance = e.score; }
		}

		return {
			norm: RADAR_AXIS_ORDER.map(key => peaks[key]),
			raw: RADAR_AXIS_ORDER.map(key => rawPeaks[key] === -Infinity ? 0 : rawPeaks[key]),
		};
	}

	function floorValues(): { norm: number[]; raw: number[] } {
		const floors: Record<string, number> = {};
		const rawFloors: Record<string, number> = {};
		for (const key of RADAR_AXIS_ORDER) { floors[key] = 100; rawFloors[key] = Infinity; }

		for (const s of statusHistory) {
			const v = s.vo2max;
			if (normalize('vo2max', v) <= floors.vo2max) { floors.vo2max = normalize('vo2max', v); rawFloors.vo2max = v; }
			const bal = rolling30dBalance(fullStatusHistory, s.date);
			if (bal <= floors.balance) { floors.balance = bal; rawFloors.balance = bal; }
			const prod = computeProductivity(fullStatusHistory, s.date);
			if (prod >= 0 && prod <= floors.productivity) { floors.productivity = prod; rawFloors.productivity = prod; }
		}
		for (const h of hillScoreHistory) {
			if (normalize('hill', h.overall) <= floors.hill) { floors.hill = normalize('hill', h.overall); rawFloors.hill = h.overall; }
		}
		for (const e of enduranceScoreHistory) {
			if (normalize('endurance', e.score) <= floors.endurance) { floors.endurance = normalize('endurance', e.score); rawFloors.endurance = e.score; }
		}

		return {
			norm: RADAR_AXIS_ORDER.map(key => floors[key]),
			raw: RADAR_AXIS_ORDER.map(key => rawFloors[key] === Infinity ? 0 : rawFloors[key]),
		};
	}

	const radarData = $derived(() =>
		RADAR_AXIS_ORDER.map(key => {
			const raw = rawValue(key);
			const pct = normalize(key, raw);
			return {
				key,
				axis: AXES[key].name,
				value: pct,
				raw,
				rawStr: formatRaw(key, raw),
			};
		})
	);

	let _chart: any;
	let _ro: ResizeObserver;
	let _ready = $state(false);
	let _indicatorNames: string[] = [];
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function renderChart() {
		if (!_chart) return;
		const rd = radarData();
		const peakData = peakValues();
		const floorData = floorValues();
		const peaks = peakData.norm;
		const floors = floorData.norm;
		const rawPeaks = peakData.raw;
		const rawFloors = floorData.raw;

		_chart.setOption({
			radar: {
				triggerEvent: true,
				indicator: rd.map((d, i) => ({
					name: `{val|${d.rawStr}}\n{dot${i}|●} {name|${d.axis}}`,
					max: 100,
				})),
				shape: 'polygon',
				radius: '72%',
				center: ['50%', '58%'],
				axisName: {
					rich: {
						val: { color: C.text, fontSize: 12, fontWeight: 'bold', fontFamily: MONO, align: 'center' },
						name: { color: C.textSecondary, fontSize: 10, fontFamily: MONO, align: 'center' },
						...Object.fromEntries(RADAR_AXIS_ORDER.map((key, i) => [
							`dot${i}`, { color: AXIS_COLORS[key], fontSize: 12, align: 'center' },
						])),
					},
				},
				axisLine: { lineStyle: { color: C.hover } },
				splitLine: { lineStyle: { color: C.cardBorder } },
				splitArea: { show: false },
			},
			tooltip: { show: false },
			series: [{
				type: 'radar',
				data: [
					{
						value: floors,
						name: 'Low',
						areaStyle: { color: 'rgba(239, 68, 68, 0.15)' },
						lineStyle: { color: 'rgba(239, 68, 68, 0.6)', width: 1.5, type: 'dashed' },
						itemStyle: { color: 'rgba(239, 68, 68, 0.6)' },
						symbol: 'circle',
						symbolSize: 3,
						z: 0,
					},
					{
						value: peaks,
						name: 'Peak',
						areaStyle: { color: 'rgba(59, 130, 246, 0.12)' },
						lineStyle: { color: 'rgba(59, 130, 246, 0.5)', width: 1.5, type: 'dashed' },
						itemStyle: { color: 'rgba(59, 130, 246, 0.5)' },
						symbol: 'circle',
						symbolSize: 3,
						z: 1,
					},
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
		}, true);

		// Keep indicator names fresh for axis-name hover lookup
		_indicatorNames = rd.map((d, i) => `{val|${d.rawStr}}\n{dot${i}|●} {name|${d.axis}}`);
	}

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(radarEl, undefined, { renderer: 'svg' });

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(radarEl);

		_chart.on('mouseover', (params: any) => {
			if (params.targetType === 'axisName') {
				const idx = _indicatorNames.indexOf(params.name);
				if (idx >= 0) {
					const key = RADAR_AXIS_ORDER[idx];
					const e = (params.event?.event ?? params.event) as MouseEvent;
					axisTip = { visible: true, text: AXES[key].tip, x: e.clientX, y: e.clientY - 12 };
				}
			}
		});
		_chart.on('mouseout', (params: any) => {
			if (params.targetType === 'axisName') {
				axisTip = { ...axisTip, visible: false };
			}
		});

		_ready = true;
	});

	$effect(() => {
		if (!_ready) return;
		hillScore; currentStatus; enduranceScore; vo2max; statusHistory; fullStatusHistory; hillScoreHistory; enduranceScoreHistory;
		renderChart();
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartPolar size={14} weight="bold" /> Profile</h2>
	<div bind:this={radarEl} class="flex-1 min-h-[200px] w-full"></div>
{#if axisTip.visible}
	<span class="axis-tip" style="left:{axisTip.x}px;top:{axisTip.y}px">
		{#each axisTip.text.split('\n') as line, i}
			{#if i > 0}<br/>{/if}{line}
		{/each}
	</span>
{/if}
</div>

<style>
	.axis-tip {
		position: fixed;
		z-index: 50;
		width: max-content;
		max-width: min(340px, calc(100vw - 24px));
		padding: 8px 12px;
		border-radius: 6px;
		background: #1e1e2a;
		border: 1px solid #2a2a3a;
		color: #c8c8d4;
		font-size: 11px;
		line-height: 1.6;
		font-weight: 400;
		white-space: normal;
		pointer-events: none;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		transform: translateX(-50%) translateY(-100%);
	}
</style>
