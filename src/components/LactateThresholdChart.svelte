<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { LactateThreshold } from '$lib/types.js';
	import { fmtDateISO } from '$lib/dates.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import Pulse from 'phosphor-svelte/lib/Pulse';

	interface Props {
		history: LactateThreshold[];
		windowStart: string;
	}

	let { history, windowStart }: Props = $props();
	let chartEl: HTMLDivElement;

	const SERIES_KEYS = ['hr', 'pace'] as const;
	type SeriesKey = typeof SERIES_KEYS[number];

	const SERIES_META: Record<SeriesKey, { name: string; color: string; tip: string }> = {
		hr:   { name: 'HR',   color: C.amber, tip: 'Lactate threshold heart rate (bpm)' },
		pace: { name: 'Pace', color: C.blue,  tip: 'Lactate threshold pace (min/km)' },
	};

	let hiddenSeries = $state(new Set<SeriesKey>());

	function toggleSeries(key: SeriesKey) {
		const next = new Set(hiddenSeries);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		hiddenSeries = next;
		renderChart();
	}

	// Parse "4:48" → 288 seconds/km
	function paceToSec(p: string): number {
		const [m, s] = p.split(':').map(Number);
		return (m ?? 0) * 60 + (s ?? 0);
	}

	// Format sec/km → "4:48"
	function secToPace(sec: number): string {
		const m = Math.floor(sec / 60);
		const s = Math.round(sec - m * 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	// Series = raw change points within the window + a trailing anchor at today
	// carrying the last known value forward, so the line extends to the present.
	interface DayPoint { date: string; bpm: number; paceSec: number; isChange: boolean; }

	function buildSeries(): DayPoint[] {
		if (history.length === 0) return [];
		const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
		const todayStr = fmtDateISO(new Date());

		const inWindow = sorted.filter(p => p.date >= windowStart && p.date <= todayStr);
		const lastSeen = sorted.filter(p => p.date <= todayStr).pop();
		if (!lastSeen) return [];

		const result: DayPoint[] = inWindow.map(p => ({
			date: p.date,
			bpm: p.heart_rate,
			paceSec: paceToSec(p.pace),
			isChange: true,
		}));

		if (result.length === 0 || result[result.length - 1].date !== todayStr) {
			result.push({
				date: todayStr,
				bpm: lastSeen.heart_rate,
				paceSec: paceToSec(lastSeen.pace),
				isChange: false,
			});
		}

		return result;
	}

	const stats = $derived(() => {
		const data = buildSeries();
		if (data.length === 0) return { current: null as LactateThreshold | null, bpmDelta: 0, paceDelta: 0 };
		const first = data[0];
		const last = data[data.length - 1];
		return {
			current: history[history.length - 1] ?? null,
			bpmDelta: last.bpm - first.bpm,
			paceDelta: last.paceSec - first.paceSec,
		};
	});

	let _chart: any; let _ro: ResizeObserver;
	let _ready = $state(false);
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function renderChart() {
		if (!_chart) return;
		const data = buildSeries();
		const dates = data.map(d => d.date.slice(5));
		const bpmValues = data.map(d => d.bpm);
		const paceValues = data.map(d => d.paceSec);

		const hideHr = hiddenSeries.has('hr');
		const hidePace = hiddenSeries.has('pace');
		const nil = data.map(() => null);

		_chart.setOption({
			grid: { top: 8, right: 0, bottom: 30, left: 0, containLabel: false },
			legend: { show: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter(params: any) {
					const idx = params[0]?.dataIndex ?? 0;
					const d = data[idx];
					let html = `<b>${dates[idx]}</b>${d.isChange ? ` <span style="color:${C.textDim}">· updated</span>` : ''}<br/><table style="border-spacing:8px 1px">`;
					html += `<tr><td>HR&nbsp;</td><td style="text-align:right"><b>${d.bpm}</b>&nbsp;</td><td style="color:${C.textDim}">bpm</td></tr>`;
					html += `<tr><td>Pace&nbsp;</td><td style="text-align:right"><b>${secToPace(d.paceSec)}</b>&nbsp;</td><td style="color:${C.textDim}">min/km</td></tr>`;
					html += '</table>';
					return html;
				},
			},
			xAxis: {
				type: 'category', data: dates, boundaryGap: false,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, showMinLabel: false, showMaxLabel: false },
			},
			yAxis: [
				{
					type: 'value',
					position: 'left',
					min: (v: { min: number }) => Math.floor(v.min - 2),
					max: (v: { max: number }) => Math.ceil(v.max + 2),
					axisLine: { show: false },
					axisLabel: CHART_AXIS.axisLabel,
					splitLine: CHART_AXIS.splitLine,
				},
				{
					type: 'value',
					position: 'right',
					// Invert pace axis — faster (lower sec) appears higher
					inverse: true,
					min: (v: { min: number }) => Math.floor(v.min - 5),
					max: (v: { max: number }) => Math.ceil(v.max + 5),
					axisLine: { show: false },
					axisLabel: {
						...CHART_AXIS.axisLabel,
						formatter: (v: number) => secToPace(v),
					},
					splitLine: { show: false },
				},
			],
			series: [
				{
					type: 'line', name: 'HR', yAxisIndex: 0,
					data: hideHr ? nil : bpmValues,
					smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.amber },
					itemStyle: { color: C.amber },
					z: 3,
				},
				{
					type: 'line', name: 'Pace', yAxisIndex: 1,
					data: hidePace ? nil : paceValues,
					smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.blue },
					itemStyle: { color: C.blue },
					z: 2,
				},
			],
		}, true);
	}

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
		_ready = true;
	});

	$effect(() => {
		if (!_ready) return;
		history; windowStart; hiddenSeries;
		renderChart();
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="mb-2">
		<div class="flex flex-wrap items-center justify-between gap-y-1">
			<Tip text={"Lactate threshold — HR and pace at which lactate starts accumulating.\nUpdated by Garmin when an effort reveals a new threshold.\n\nAmber = HR (bpm)\nBlue = Pace (min/km, inverted — higher = faster)"}>
				<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><Pulse size={14} weight="bold" /> Lactate Threshold</h2>
			</Tip>
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
				{#each SERIES_KEYS as key}
					<Tip text={SERIES_META[key].tip}>
						<button
							class="flex items-center gap-1 cursor-pointer transition-opacity {hiddenSeries.has(key) ? 'opacity-30' : 'text-text-secondary'}"
							onclick={() => toggleSeries(key)}
						>
							<span class="inline-block w-2.5 h-0.5 rounded-full" style="background:{SERIES_META[key].color}"></span>
							{SERIES_META[key].name}
						</button>
					</Tip>
				{/each}
			</div>
		</div>
		{#if stats().current}
			<div class="flex items-center gap-3 text-[10px] num mt-1">
				<span class="text-text-secondary"><b class="text-text">{stats().current!.heart_rate}</b> bpm</span>
				<span class="text-text-secondary"><b class="text-text">{stats().current!.pace}</b> /km</span>
			</div>
		{/if}
	</div>
	<div bind:this={chartEl} class="flex-1 min-h-[140px] w-full"></div>
</div>
