<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { DailyTrainingStatus, HillScore, EnduranceScore } from '$lib/types.js';
	import { AXES, AXIS_ORDER, AXIS_COLORS, PROFILE_LABEL, normalize, formatRaw, computeBalance } from '$lib/profile.js';
	import { weekMonday, utcDate } from '$lib/dates.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import TrendUp from 'phosphor-svelte/lib/TrendUp';
	import Tip from './Tip.svelte';

	interface Props {
		statusHistory: DailyTrainingStatus[];
		hillScoreHistory: HillScore[];
		enduranceScoreHistory: EnduranceScore[];
		daily?: boolean;
	}

	let { statusHistory, hillScoreHistory, enduranceScoreHistory, daily = false }: Props = $props();
	let chartEl: HTMLDivElement;

	interface DataPoint {
		key: string;
		label: string;
		vo2max: number;
		endurance: number | null;
		balance: number | null;
		hillStr: number | null;
		hillEnd: number | null;
		rawVo2: number;
		rawEndurance: number | null;
		rawBalance: number | null;
		rawHillStr: number | null;
		rawHillEnd: number | null;
	}

	function buildPoint(key: string, label: string, s: DailyTrainingStatus, hill: HillScore | undefined, endur: EnduranceScore | undefined): DataPoint {
		const vo2 = s.vo2max_precise > 0 ? s.vo2max_precise : s.vo2max;
		const bal = computeBalance(s);
		return {
			key, label,
			vo2max: normalize('vo2max', vo2),
			endurance: endur ? normalize('endurance', endur.score) : null,
			balance: bal >= 0 ? bal : null,
			hillStr: hill ? normalize('hillStr', hill.strength) : null,
			hillEnd: hill ? normalize('hillEnd', hill.endurance) : null,
			rawVo2: vo2,
			rawEndurance: endur?.score ?? null,
			rawBalance: bal >= 0 ? bal : null,
			rawHillStr: hill?.strength ?? null,
			rawHillEnd: hill?.endurance ?? null,
		};
	}

	const chartData = $derived((): DataPoint[] => {
		const hillByDate = new Map<string, HillScore>();
		for (const h of hillScoreHistory) hillByDate.set(h.date, h);
		const endurByDate = new Map<string, EnduranceScore>();
		for (const e of enduranceScoreHistory) endurByDate.set(e.date, e);

		if (daily) {
			// Daily mode: one point per day from statusHistory
			return statusHistory.map(s => {
				const dt = utcDate(s.date);
				const label = `${dt.getUTCDate()} ${dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
				return buildPoint(s.date, label, s, hillByDate.get(s.date), endurByDate.get(s.date));
			});
		}

		// Weekly mode: group by Monday, take last entry per week
		const hillByWeek = new Map<string, HillScore>();
		for (const h of hillScoreHistory) hillByWeek.set(weekMonday(h.date), h);
		const endurByWeek = new Map<string, EnduranceScore>();
		for (const e of enduranceScoreHistory) endurByWeek.set(weekMonday(e.date), e);

		const weekStatus = new Map<string, DailyTrainingStatus>();
		for (const s of statusHistory) weekStatus.set(weekMonday(s.date), s);

		return [...weekStatus.keys()].sort().map(week => {
			const s = weekStatus.get(week)!;
			const dt = utcDate(week);
			const label = `${dt.getUTCDate()} ${dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
			return buildPoint(week, label, s, hillByWeek.get(week), endurByWeek.get(week));
		});
	});

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		const data = chartData();
		const labels = data.map(d => d.label);

		const makeSeries = (key: string, values: (number | null)[]) => ({
			type: 'line' as const,
			name: AXES[key].name,
			data: values,
			smooth: true,
			symbol: 'circle',
			symbolSize: 4,
			lineStyle: { width: 2, color: AXIS_COLORS[key] },
			itemStyle: { color: AXIS_COLORS[key] },
			connectNulls: false,
		});

		// Series values (normalized for y-axis)
		const normalizedMap: Record<string, (d: DataPoint) => number | null> = {
			vo2max: d => d.vo2max,
			endurance: d => d.endurance,
			balance: d => d.balance,
			hillStr: d => d.hillStr,
			hillEnd: d => d.hillEnd,
		};
		// Raw values for tooltips
		const rawMap: Record<string, (d: DataPoint) => number | null> = {
			vo2max: d => d.rawVo2,
			endurance: d => d.rawEndurance,
			balance: d => d.rawBalance,
			hillStr: d => d.rawHillStr,
			hillEnd: d => d.rawHillEnd,
		};

		const allNormalized: Record<string, (number | null)[]> = {};
		const allRaw: Record<string, (number | null)[]> = {};
		for (const key of AXIS_ORDER) {
			allNormalized[key] = data.map(normalizedMap[key]);
			allRaw[key] = data.map(rawMap[key]);
		}

		_chart.setOption({
			grid: { top: 35, right: 16, bottom: 30, left: 35 },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					const idx = params[0].dataIndex;
					let html = `<b>${params[0].axisValueLabel}</b><br/>`;
					for (const p of params) {
						if (p.value == null) continue;
						const key = AXIS_ORDER.find(k => AXES[k].name === p.seriesName);
						if (!key) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`;
						const raw = allRaw[key]?.[idx];
						const rawStr = raw != null ? formatRaw(key, raw) : '';
						const pct = p.value;
						let delta = '';
						if (idx > 0) {
							const prev = allNormalized[key]?.[idx - 1];
							if (prev != null) {
								const d = pct - prev;
								const sign = d > 0 ? '+' : '';
								const color = d > 0 ? C.green : d < 0 ? C.red : C.textDim;
								delta = ` <span style="color:${color};font-size:10px">${sign}${d}%</span>`;
							}
						}
						html += `${dot}${p.seriesName}: <b>${rawStr}</b> <span style="color:${C.textDim}">(${pct}%)</span>${delta}<br/>`;
					}
					return html;
				},
			},
			legend: { show: false },
			xAxis: {
				type: 'category', data: labels,
				...CHART_AXIS,
			},
			yAxis: {
				type: 'value', min: 0, max: 100,
				axisLine: { show: false },
				axisLabel: { ...CHART_AXIS.axisLabel, formatter: (v: number) => `${v}%` },
				splitLine: CHART_AXIS.splitLine,
			},
			series: AXIS_ORDER.map(key => makeSeries(key, allNormalized[key])),
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="flex flex-wrap items-center justify-between gap-y-1 mb-2">
		<Tip text={`5 dimensions plotted weekly.\nY-axis: normalized 0–100% (${PROFILE_LABEL}).\nTooltips show raw values.`}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><TrendUp size={14} weight="bold" /> Profile Trend</h2>
		</Tip>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
			{#each AXIS_ORDER as key}
				<Tip text={AXES[key].tip}>
					<span class="flex items-center gap-1 text-text-secondary">
						<span class="inline-block w-2.5 h-0.5 rounded-full" style="background:{AXIS_COLORS[key]}"></span>
						{AXES[key].name}
					</span>
				</Tip>
			{/each}
		</div>
	</div>
	<div bind:this={chartEl} class="flex-1 min-h-[200px] w-full"></div>
</div>
