<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { DailyTrainingStatus, HillScore, EnduranceScore } from '$lib/types.js';
	import { AXES, AXIS_ORDER, AXIS_COLORS, PROFILE_LABEL, normalize, estimate5kFromVo2, computeBalance } from '$lib/profile.js';
	import Tip from './Tip.svelte';

	interface Props {
		statusHistory: DailyTrainingStatus[];
		hillScoreHistory: HillScore[];
		enduranceScoreHistory: EnduranceScore[];
	}

	let { statusHistory, hillScoreHistory, enduranceScoreHistory }: Props = $props();
	let chartEl: HTMLDivElement;

	function getWeekKey(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		const day = d.getDay();
		d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	const weeklyData = $derived(() => {
		const weekStatus = new Map<string, DailyTrainingStatus>();
		for (const s of statusHistory) {
			weekStatus.set(getWeekKey(s.date), s);
		}

		const weekHill = new Map<string, HillScore>();
		for (const h of hillScoreHistory) {
			weekHill.set(getWeekKey(h.date), h);
		}
		const weekEndurance = new Map<string, EnduranceScore>();
		for (const e of enduranceScoreHistory) {
			weekEndurance.set(getWeekKey(e.date), e);
		}

		const weeks = [...weekStatus.keys()].sort();

		return weeks.map(week => {
			const s = weekStatus.get(week)!;
			const vo2 = s.vo2max_precise > 0 ? s.vo2max_precise : s.vo2max;
			const bal = computeBalance(s);
			const hill = weekHill.get(week);
			const endur = weekEndurance.get(week);

			return {
				week,
				label: new Date(week + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
				vo2max: normalize('vo2max', vo2),
				speed: normalize('speed', estimate5kFromVo2(vo2)),
				endurance: endur ? normalize('endurance', endur.score) : null,
				balance: bal >= 0 ? bal : null,
				hillStr: hill ? normalize('hillStr', hill.strength) : null,
				hillEnd: hill ? normalize('hillEnd', hill.endurance) : null,
			};
		});
	});

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		const data = weeklyData();
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

		// Pre-compute series arrays for delta calculation in tooltip
		const valueMap: Record<string, (d: any) => number | null> = {
			vo2max: d => d.vo2max,
			speed: d => d.speed,
			endurance: d => d.endurance,
			balance: d => d.balance,
			hillStr: d => d.hillStr,
			hillEnd: d => d.hillEnd,
		};
		const allSeries: Record<string, (number | null)[]> = {};
		for (const key of AXIS_ORDER) {
			allSeries[key] = data.map(valueMap[key]);
		}

		_chart.setOption({
			grid: { top: 35, right: 16, bottom: 30, left: 35 },
			tooltip: {
				trigger: 'axis',
				confine: true,
				backgroundColor: '#1e1e2a',
				borderColor: '#2a2a3a',
				textStyle: { color: '#e8e8ed', fontSize: 11 },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					const idx = params[0].dataIndex;
					let html = `<b>${params[0].axisValueLabel}</b><br/>`;
					for (const p of params) {
						if (p.value == null) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`;
						let delta = '';
						if (idx > 0) {
							const key = AXIS_ORDER.find(k => AXES[k].name === p.seriesName);
							const prev = key ? allSeries[key]?.[idx - 1] : null;
							if (prev != null) {
								const d = p.value - prev;
								const sign = d > 0 ? '+' : '';
								const color = d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#555568';
								delta = ` <span style="color:${color};font-size:10px">${sign}${d}</span>`;
							}
						}
						html += `${dot}${p.seriesName}: <b>${p.value}</b>${delta}<br/>`;
					}
					return html;
				},
			},
			legend: {
				data: AXIS_ORDER.map(key => ({ name: AXES[key].name, itemStyle: { color: AXIS_COLORS[key] } })),
				top: 4,
				textStyle: { color: '#8888a0', fontSize: 10 },
				itemWidth: 12,
				itemHeight: 8,
			},
			xAxis: {
				type: 'category',
				data: labels,
				axisLine: { lineStyle: { color: '#2a2a3a' } },
				axisLabel: { color: '#555568', fontSize: 10 },
			},
			yAxis: {
				type: 'value',
				min: 0,
				max: 100,
				axisLine: { show: false },
				axisLabel: { color: '#555568', fontSize: 10 },
				splitLine: { lineStyle: { color: '#1e1e2a' } },
			},
			series: AXIS_ORDER.map(key => makeSeries(key, allSeries[key])),
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<Tip text={`Same 6 dimensions as the radar, plotted weekly.\nAll values on the same 0–100 scale (${PROFILE_LABEL}).\nPolarization uses a rolling 4-week window.`}>
		<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">Profile Trend</h2>
	</Tip>
	<div bind:this={chartEl} class="flex-1 min-h-[200px] w-full"></div>
</div>
