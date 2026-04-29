<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { LactateThreshold } from '$lib/types.js';
	import { fmtDateISO } from '$lib/dates.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import { bindTooltipOutsideClick } from '$lib/echarts-helpers.js';
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

	// Convert speed (m/s) to pace (seconds per km)
	function speedToPaceSec(speedMps: number): number {
		return speedMps > 0 ? Math.round(1000 / speedMps) : 0;
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

		// Anchor the line at windowStart with the last-known-before-window value
		// so the step line spans the full window even when the next change point
		// is mid-window.
		const beforeWindow = sorted.filter(p => p.date < windowStart).pop();
		const result: DayPoint[] = [];
		if (beforeWindow && (inWindow.length === 0 || inWindow[0].date !== windowStart)) {
			result.push({
				date: windowStart,
				bpm: beforeWindow.heart_rate,
				paceSec: speedToPaceSec(beforeWindow.speed_mps),
				isChange: false,
			});
		}
		for (const p of inWindow) {
			result.push({
				date: p.date,
				bpm: p.heart_rate,
				paceSec: speedToPaceSec(p.speed_mps),
				isChange: true,
			});
		}

		if (result.length === 0 || result[result.length - 1].date !== todayStr) {
			result.push({
				date: todayStr,
				bpm: lastSeen.heart_rate,
				paceSec: speedToPaceSec(lastSeen.speed_mps),
				isChange: false,
			});
		}

		return result;
	}

	// Latest known LT value for the in-header summary.
	const current = $derived(history.length > 0 ? history[history.length - 1] : null);

	/** Pick a "nice" step ≥ minStep so the axis shows at most `targetTicks` labels. */
	function niceStep(range: number, minStep: number, targetTicks = 5): number {
		const mults = [1, 2, 5];
		let mag = 1;
		while (mag < 1e9) {
			for (const m of mults) {
				const step = minStep * m * mag;
				if (range / step <= targetTicks) return step;
			}
			mag *= 10;
		}
		return minStep;
	}

	function yScale(values: number[], minStep: number): { min: number; max: number; step: number } {
		if (values.length === 0) return { min: 0, max: minStep, step: minStep };
		const mn = Math.min(...values);
		const mx = Math.max(...values);
		const range = Math.max(mx - mn, minStep);
		const step = niceStep(range, minStep);
		const eps = 1e-9;
		let lo = Math.floor(mn / step) * step;
		let hi = Math.ceil(mx / step) * step;
		if (mn - lo < eps) lo -= step;
		if (hi - mx < eps) hi += step;
		return { min: lo, max: hi, step };
	}

	let _chart: any; let _ro: ResizeObserver;
	let _ready = $state(false);
	let _unbindTooltip: (() => void) | null = null;
	onDestroy(() => { _unbindTooltip?.(); _ro?.disconnect(); _chart?.dispose(); });

	function renderChart() {
		if (!_chart) return;
		const data = buildSeries();
		const bpmValues = data.map(d => d.bpm);
		const paceValues = data.map(d => d.paceSec);
		// Tag each point with its UTC timestamp so the x-axis spaces sparse
		// updates at their real-time positions instead of evenly.
		const ts = (d: DayPoint) => Date.parse(d.date + 'T12:00:00Z');
		const paceTs = data.map(d => [ts(d), d.paceSec] as [number, number]);
		const bpmTs = data.map(d => [ts(d), d.bpm] as [number, number]);

		const hideHr = hiddenSeries.has('hr');
		const hidePace = hiddenSeries.has('pace');

		// "DD/MM" — matches the format used by ProjectionChart and the trend cards.
		const dateLabel = (t: number) => {
			const d = new Date(t);
			return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
		};

		_chart.setOption({
			animation: false,
			grid: { top: 8, right: 8, bottom: 30, left: 36, containLabel: false },
			legend: { show: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter(params: any) {
					const idx = params[0]?.dataIndex ?? 0;
					const d = data[idx];
					let html = `<b>${dateLabel(ts(d))}</b>${d.isChange ? ` <span style="color:${C.textDim}">· updated</span>` : ''}<br/><table style="border-spacing:8px 1px">`;
					html += `<tr><td>HR&nbsp;</td><td style="text-align:right"><b>${d.bpm}</b>&nbsp;</td><td style="color:${C.textDim}">bpm</td></tr>`;
					html += `<tr><td>Pace&nbsp;</td><td style="text-align:right"><b>${secToPace(d.paceSec)}</b>&nbsp;</td><td style="color:${C.textDim}">min/km</td></tr>`;
					html += '</table>';
					return html;
				},
			},
			xAxis: {
				type: 'time',
				...CHART_AXIS,
				axisLabel: {
					...CHART_AXIS.axisLabel,
					hideOverlap: true,
					formatter: (v: number) => dateLabel(v),
				},
			},
			yAxis: (() => {
				const hrScale = yScale(bpmValues, 1);
				const paceScale = yScale(paceValues, 5);
				return [
					{
						// Pace — natural y-axis: lower pace number (faster) at the
						// bottom. Improvement makes the line trend down.
						type: 'value',
						position: 'left',
						min: paceScale.min, max: paceScale.max, interval: paceScale.step,
						axisLine: { show: false },
						axisLabel: {
							...CHART_AXIS.axisLabel,
							formatter: (v: number) => secToPace(v),
						},
						splitLine: CHART_AXIS.splitLine,
					},
					{
						// HR — keep the axis internally to plot the line, but hide its labels
						type: 'value',
						position: 'right',
						min: hrScale.min, max: hrScale.max, interval: hrScale.step,
						axisLine: { show: false },
						axisLabel: { show: false },
						splitLine: { show: false },
					},
				];
			})(),
			series: [
				{
					type: 'line', name: 'Pace', yAxisIndex: 0,
					data: hidePace ? [] : paceTs,
					smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.blue },
					itemStyle: { color: C.blue },
					z: 3,
				},
				{
					type: 'line', name: 'HR', yAxisIndex: 1,
					data: hideHr ? [] : bpmTs,
					smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.amber },
					itemStyle: { color: C.amber },
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
		_unbindTooltip = bindTooltipOutsideClick(_chart, chartEl);
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
			<Tip text={"Lactate threshold — HR and pace at which lactate starts accumulating.\nUpdated by Garmin when an effort reveals a new threshold.\n\nAmber = HR (bpm)\nBlue = Pace (min/km — lower is faster)"}>
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
		{#if current}
			<div class="flex items-center gap-3 text-[10px] num mt-1">
				<span class="text-text-secondary"><b class="text-text">{current.heart_rate}</b> bpm</span>
				<span class="text-text-secondary"><b class="text-text">{secToPace(speedToPaceSec(current.speed_mps))}</b> /km</span>
			</div>
		{/if}
	</div>
	<div bind:this={chartEl} class="flex-1 min-h-[140px] w-full"></div>
</div>
