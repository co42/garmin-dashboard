<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { CoachEvent, EventProjection } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import { addDays, today as todayFn } from '$lib/dates.js';
	import { formatTime } from '$lib/format.js';
	import { feedbackLabel } from '$lib/coach-feedback.js';
	import Tip from './Tip.svelte';
	import Target from 'phosphor-svelte/lib/Target';

	interface Props {
		history: EventProjection[];
		event: CoachEvent;
		planStartDate?: string | null;
	}

	let { history, event, planStartDate = null }: Props = $props();

	const todayStr = $derived(todayFn());
	const distanceKm = $derived(event.distance_meters ? event.distance_meters / 1000 : null);

	// Default pace (user preference). If no distance, fall back to time mode.
	let mode = $state<'pace' | 'time'>('pace');
	$effect(() => { if (!distanceKm && mode === 'pace') mode = 'time'; });

	// Legend (toggleable): baseline, projection, goal. Today-dot rides with baseline.
	const LEGEND_KEYS = ['baseline', 'projection', 'goal'] as const;
	type LegendKey = typeof LEGEND_KEYS[number];
	const LEGEND_META: Record<LegendKey, { name: string; color: string; opacity?: number; tip: string }> = {
		baseline:   { name: 'Baseline',   color: C.text,  tip: 'Fitness-only race-time prediction (ignores plan boost)' },
		projection: { name: 'Projection', color: C.blue,  tip: 'Plan-adjusted race-time forecast at event day, with confidence band' },
		goal:       { name: 'Goal',       color: C.green, tip: 'Your goal time for the event' },
	};
	let hiddenSeries = $state(new Set<LegendKey>());
	function toggleSeries(key: LegendKey) {
		const next = new Set(hiddenSeries);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		hiddenSeries = next;
		renderChart();
	}

	let chartEl: HTMLDivElement | undefined = $state();
	let _chart: any;
	let _ro: ResizeObserver;
	let _ready = $state(false);
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function toPace(seconds: number): number {
		// fractional s/km — rounding happens at format time, not here
		return distanceKm ? seconds / distanceKm : seconds;
	}
	function valueFor(seconds: number | null): number | null {
		if (seconds == null) return null;
		return mode === 'pace' ? toPace(seconds) : seconds;
	}
	function formatPaceMSS(paceSecPerKm: number): string {
		const total = Math.round(paceSecPerKm);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}
	// Axis labels: H:MM (drop seconds — noise on a race-projection scale).
	function formatTimeHMM(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
		return `${m}m`;
	}
	function formatYAxis(v: number): string {
		return mode === 'pace' ? formatPaceMSS(v) : formatTimeHMM(v);
	}
	// Tooltips keep the full H:MM:SS / M:SS precision.
	function formatY(v: number): string {
		return mode === 'pace' ? formatPaceMSS(v) : formatTime(v);
	}

	function dot(color: string, opacity = 1, ring = false) {
		const base = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:2px`;
		const extra = opacity < 1 ? `;opacity:${opacity}` : '';
		const r = ring ? `;box-shadow:0 0 0 1px ${C.card}` : '';
		return `<span style="${base}${extra}${r}"></span>`;
	}

	// Build the full date axis: earliest history (or plan start) → event date.
	//
	// Data model — how we read Garmin's three per-day fields:
	//   past       = daily `predicted_race_time_seconds` (fitness-only baseline)
	//   future     = linear from today's prediction → today's projection at event day
	//   fLower     = linear from today's prediction → today's lower_bound at event day
	//   fUpper     = linear from today's prediction → today's upper_bound at event day
	//
	// The past white line + today-dot sit on the fitness baseline (prediction). The
	// forward cone emanates from that baseline and converges on today's plan-adjusted
	// projection at event day, with the confidence band widening to `[lower, upper]`.
	// Everything fans downward when the plan is expected to improve on the baseline.
	type Row = {
		date: string;
		past: number | null;
		future: number | null;
		fLower: number | null;
		fUpper: number | null;
		source: EventProjection | null;
	};
	const rows = $derived.by<Row[]>(() => {
		if (history.length === 0) return [];
		const asc = [...history].sort((a, b) => a.date.localeCompare(b.date));
		const last = asc[asc.length - 1];
		const todayPred = last.predicted_race_time_seconds;
		const todayProj = last.projection_race_time_seconds;
		const todayLower = last.lower_bound_projection_race_time_seconds;
		const todayUpper = last.upper_bound_projection_race_time_seconds;

		// Anchor X-axis at plan start if provided, else the earliest history point.
		const histStart = asc[0].date.slice(0, 10);
		const planStart = planStartDate ? planStartDate.slice(0, 10) : null;
		const firstDate = planStart && planStart < histStart ? planStart : histStart;
		const pivotDate = todayStr >= firstDate ? todayStr : firstDate;
		const endDate = event.date.slice(0, 10);

		const dates: string[] = [];
		let d = firstDate;
		while (d <= endDate) {
			dates.push(d);
			d = addDays(d, 1);
		}

		const histMap = new Map<string, EventProjection>(asc.map(h => [h.date.slice(0, 10), h]));
		const pivotIdx = dates.indexOf(pivotDate);
		const lastIdx = dates.length - 1;
		const span = Math.max(1, lastIdx - pivotIdx);

		return dates.map((date, i) => {
			const source = histMap.get(date) ?? null;
			const row: Row = { date, past: null, future: null, fLower: null, fUpper: null, source };
			if (i <= pivotIdx && source) {
				row.past = source.predicted_race_time_seconds ?? null;
			}
			if (i >= pivotIdx && todayPred != null) {
				const t = (i - pivotIdx) / span; // 0 at today → 1 at event day
				if (todayProj != null)  row.future = todayPred + (todayProj  - todayPred) * t;
				if (todayLower != null) row.fLower = todayPred + (todayLower - todayPred) * t;
				if (todayUpper != null) row.fUpper = todayPred + (todayUpper - todayPred) * t;
			}
			return row;
		});
	});

	function renderChart() {
		if (!_chart) return;
		const data = rows;
		if (data.length === 0) return;

		const hideBaseline = hiddenSeries.has('baseline');
		const hideProj = hiddenSeries.has('projection');
		const hideGoal = hiddenSeries.has('goal');

		// Short X labels: "DD/MM"
		const axis = data.map(r => r.date.slice(5).split('-').reverse().join('/'));

		const pastV = data.map(r => hideBaseline ? null : valueFor(r.past));
		const futureV = data.map(r => hideProj ? null : valueFor(r.future));
		const lowerV = data.map(r => hideProj ? null : valueFor(r.fLower));
		const upperV = data.map(r => hideProj ? null : valueFor(r.fUpper));
		const bandDelta = upperV.map((u, i) => (u != null && lowerV[i] != null ? u - (lowerV[i] as number) : null));

		// Today dot sits on the past series at pivotIdx; ECharts symbols show only when data is non-null.
		const pivotIdx = data.findIndex(r => r.date === todayStr);
		const todaySymbolSize = (_val: any, p: any) => (p.dataIndex === pivotIdx && !hideBaseline ? 8 : 0);

		const goalV = event.goal_seconds != null && !hideGoal ? valueFor(event.goal_seconds) : null;

		// Vertical marker at plan start (only if data exists before plan start,
		// i.e. Garmin handed us projections pre-dating the current plan).
		const planStartIdx = planStartDate
			? data.findIndex(r => r.date === planStartDate.slice(0, 10))
			: -1;
		const showPlanStart = planStartIdx > 0; // > 0 so we don't mark the very first day

		_chart.setOption({
			grid: { top: 8, right: 0, bottom: 30, left: 0, containLabel: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					const idx = params[0].dataIndex;
					const r = data[idx];
					const isPast = idx <= pivotIdx;
					const isToday = idx === pivotIdx;
					const focus = r.source?.feedback_phrase ? feedbackLabel(r.source.feedback_phrase) : null;

					const fmt = (s: number | null) => s == null ? '—' : formatY(valueFor(s) as number);
					const label = mode === 'pace' ? '/km' : '';

					let html = `<b>${params[0].axisValueLabel}${isToday ? ' · today' : ''}</b><br/><table style="border-spacing:8px 1px">`;
					if (isPast && r.past != null) {
						html += `<tr><td>${dot(C.text, 1, true)}Baseline&nbsp;</td><td style="text-align:right"><b>${fmt(r.past)}${label}</b></td></tr>`;
					}
					if (!isPast) {
						if (r.future != null) html += `<tr><td>${dot(C.blue)}Projection&nbsp;</td><td style="text-align:right"><b>${fmt(r.future)}${label}</b></td></tr>`;
						if (r.fLower != null && r.fUpper != null) html += `<tr><td>${dot(C.blue, 0.3)}Band&nbsp;</td><td style="text-align:right">${fmt(r.fLower)}–${fmt(r.fUpper)}${label}</td></tr>`;
					}
					if (event.goal_seconds != null) html += `<tr><td>${dot(C.green)}Goal&nbsp;</td><td style="text-align:right">${fmt(event.goal_seconds)}${label}</td></tr>`;
					if (focus) html += `<tr><td style="color:${C.textDim}">Focus&nbsp;</td><td style="text-align:right">${focus}</td></tr>`;
					html += '</table>';
					return html;
				},
			},
			legend: { show: false },
			xAxis: {
				type: 'category',
				data: axis,
				boundaryGap: false,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, showMinLabel: true, showMaxLabel: true, hideOverlap: true },
			},
			yAxis: {
				type: 'value',
				// Snap to evenly-spaced ticks: 1-minute steps in time mode,
				// 5-s/km steps in pace mode. Pad one step above/below so the data
				// isn't glued to the chart edges.
				min: (v: { min: number }) => {
					const step = mode === 'pace' ? 5 : 60;
					return Math.floor(v.min / step) * step - step;
				},
				max: (v: { max: number }) => {
					const step = mode === 'pace' ? 5 : 60;
					return Math.ceil(v.max / step) * step + step;
				},
				interval: mode === 'pace' ? 5 : 60,
				axisLine: { show: false },
				axisLabel: { ...CHART_AXIS.axisLabel, formatter: (v: number) => formatYAxis(v) },
				splitLine: CHART_AXIS.splitLine,
			},
			series: [
				// Future band — lower boundary (transparent baseline)
				{
					type: 'line', data: lowerV, name: '_bandLower',
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 0, color: 'transparent' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: 'transparent' },
					connectNulls: false,
					z: 1,
				},
				// Future band — upper (delta) with blue fill
				{
					type: 'line', data: bandDelta, name: '_bandUpper',
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 0, color: 'transparent' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: C.blue + '33' },
					connectNulls: false,
					z: 1,
				},
				// Future projection line (blue)
				{
					type: 'line', data: futureV, name: 'Projection',
					smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.blue },
					itemStyle: { color: C.blue },
					connectNulls: false,
					z: 2,
					markLine: event.goal_seconds != null && !hideGoal
						? {
								silent: true,
								symbol: 'none',
								lineStyle: { color: C.green, type: 'dashed', width: 1.5 },
								label: {
									formatter: 'Goal',
									position: 'insideEndTop',
									color: C.green,
									fontSize: 10,
									fontFamily: MONO,
								},
								data: [{ yAxis: goalV as number }],
							}
						: undefined,
				},
				// Observed baseline (white) with today-dot via symbolSize callback.
				{
					type: 'line', data: pastV, name: 'Baseline',
					smooth: true,
					symbol: 'circle',
					symbolSize: todaySymbolSize,
					showSymbol: true,
					lineStyle: { width: 2, color: C.text },
					itemStyle: {
						color: C.text,
						borderColor: C.card,
						borderWidth: 2,
					},
					connectNulls: false,
					z: 3,
					markLine: showPlanStart
						? {
								silent: true,
								symbol: 'none',
								lineStyle: { color: C.textDim, type: 'dotted', width: 1 },
								label: {
									formatter: 'Plan start',
									position: 'insideStartTop',
									color: C.textDim,
									fontSize: 10,
									fontFamily: MONO,
								},
								data: [{ xAxis: axis[planStartIdx] }],
							}
						: undefined,
				},
			],
		}, true);
	}

	onMount(async () => {
		if (!chartEl) return;
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
		_ready = true;
	});

	$effect(() => {
		if (!_ready) return;
		rows; hiddenSeries; event; mode;
		renderChart();
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="flex flex-wrap items-center justify-between gap-y-1 mb-2">
		<div class="flex items-center gap-2">
			<Tip text={"Baseline (white) = daily fitness-only prediction.\nToday = big white dot at current baseline.\nProjection (blue) = forward line from today's baseline down to the plan-adjusted projection at event day, with confidence fan.\nGoal (green) = your target time."}>
				<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
					<Target size={14} weight="bold" /> Race Projection
				</h2>
			</Tip>
			{#if distanceKm}
				<div class="flex rounded-md border border-card-border divide-x divide-card-border text-[10px] font-medium">
					<button
						class="cursor-pointer px-2 py-0.5 rounded-l-md transition-colors {mode === 'pace' ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
						onclick={() => mode = 'pace'}
					>Pace</button>
					<button
						class="cursor-pointer px-2 py-0.5 rounded-r-md transition-colors {mode === 'time' ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
						onclick={() => mode = 'time'}
					>Time</button>
				</div>
			{/if}
		</div>
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
			{#each LEGEND_KEYS as key}
				<Tip text={LEGEND_META[key].tip}>
					<button
						class="flex items-center gap-1 cursor-pointer transition-opacity {hiddenSeries.has(key) ? 'opacity-30' : 'text-text-secondary'}"
						onclick={() => toggleSeries(key)}
					>
						{#if key === 'goal'}
							<span class="inline-block w-2.5 h-0 border-t border-dashed" style="border-color:{LEGEND_META[key].color}"></span>
						{:else}
							<span
								class="inline-block w-2.5 h-0.5 rounded-full"
								style="background:{LEGEND_META[key].color}{LEGEND_META[key].opacity ? `; opacity:${LEGEND_META[key].opacity}` : ''}"
							></span>
						{/if}
						{LEGEND_META[key].name}
					</button>
				</Tip>
			{/each}
		</div>
	</div>
	{#if rows.length < 2}
		<div class="flex-1 flex items-center justify-center text-xs text-text-dim italic min-h-[200px]">
			Not enough projection data yet
		</div>
	{:else}
		<div bind:this={chartEl} class="flex-1 min-h-[200px] w-full"></div>
	{/if}
</div>
