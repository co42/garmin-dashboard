<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { DailyTrainingStatus } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import ChartLineUp from 'phosphor-svelte/lib/ChartLineUp';

	interface Props {
		history: DailyTrainingStatus[];
	}

	let { history }: Props = $props();
	let chartEl: HTMLDivElement;
	let mode = $state<'values' | 'ratio'>('values');

	const ACWR_MIN = 0.8;
	const ACWR_MAX = 1.3;

	const LEGEND_KEYS = ['acute', 'chronic', 'optimal'] as const;
	type LegendKey = typeof LEGEND_KEYS[number];

	const LEGEND_META: Record<LegendKey, { name: string; color: string; opacity?: number; tip: string; modes: ('values' | 'ratio')[] }> = {
		acute:   { name: 'Acute',   color: C.blue,  tip: '7-day training load (short-term stress)',   modes: ['values'] },
		chronic: { name: 'Chronic', color: C.teal,   opacity: 0.4, tip: '28-day training load (fitness baseline)', modes: ['values'] },
		optimal: { name: 'Optimal', color: C.green,  tip: 'Optimal acute range — ACWR 0.8–1.3',       modes: ['values', 'ratio'] },
	};

	// In ratio mode, show ACWR instead of acute/chronic
	const RATIO_LEGEND: { name: string; color: string; tip: string } = {
		name: 'ACWR', color: C.blue, tip: 'Acute / Chronic ratio',
	};

	let hiddenSeries = $state(new Set<LegendKey>());

	function toggleSeries(key: LegendKey) {
		const next = new Set(hiddenSeries);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		hiddenSeries = next;
		renderChart();
	}

	let _chart: any; let _ro: ResizeObserver;
	let _ready = $state(false);
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function dot(color: string, opacity = 1) {
		return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:2px${opacity < 1 ? `;opacity:${opacity}` : ''}"></span>`;
	}

	function renderChart() {
		if (!_chart) return;
		const days = history.map(d => d.date.slice(5));
		if (mode === 'ratio') renderRatio(days);
		else renderValues(days);
	}

	function renderRatio(days: string[]) {
		const acwrValues = history.map(d => d.chronic_load > 0 ? +(d.acute_load / d.chronic_load).toFixed(2) : null);
		const bandMin = history.map(() => ACWR_MIN);
		const bandMax = history.map(() => ACWR_MAX);
		const hideAcwr = hiddenSeries.has('acute');
		const hideOptimal = hiddenSeries.has('optimal');
		const nil = history.map(() => null);

		_chart.setOption({
			grid: { top: 8, right: 0, bottom: 30, left: 0, containLabel: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (_params: any) => {
					if (!Array.isArray(_params) || _params.length === 0) return '';
					const idx = _params[0].dataIndex;
					const d = history[idx];
					const acwr = d.chronic_load > 0 ? d.acute_load / d.chronic_load : null;
					const zone = acwr == null ? '' : acwr < 0.8 ? 'low' : acwr <= 1.3 ? 'optimal' : acwr <= 1.5 ? 'high' : 'very high';
					let html = `<b>${_params[0].axisValueLabel}</b><br/><table style="border-spacing:8px 1px">`;
					html += `<tr><td>${dot(C.blue)}ACWR&nbsp;</td><td style="text-align:right"><b>${acwr?.toFixed(2) ?? '-'}</b>&nbsp;</td><td style="color:${C.textDim}">${zone}</td></tr>`;
					html += `<tr><td>${dot(C.green, 0.5)}Optimal&nbsp;</td><td style="text-align:right"><b>${ACWR_MIN}–${ACWR_MAX}</b>&nbsp;</td><td></td></tr>`;
					html += '</table>';
					return html;
				},
			},
			legend: { show: false },
			xAxis: { type: 'category', data: days, boundaryGap: false, ...CHART_AXIS, axisLabel: { ...CHART_AXIS.axisLabel, showMinLabel: false, showMaxLabel: false } },
			yAxis: {
				type: 'value',
				min: (v: { min: number }) => Math.max(0, Math.floor((v.min - 0.1) * 10) / 10),
				axisLine: { show: false },
				axisLabel: CHART_AXIS.axisLabel,
				splitLine: CHART_AXIS.splitLine,
			},
			series: [
				{
					type: 'line', data: hideOptimal ? nil : bandMin, name: '_bandMin',
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: 'transparent' },
					z: 1,
				},
				{
					type: 'line', data: hideOptimal ? nil : bandMax.map((v, i) => +(v - bandMin[i]).toFixed(2)), name: '_bandMax',
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: C.green + '18' },
					z: 1,
				},
				{
					type: 'line', data: hideAcwr ? nil : acwrValues, name: 'ACWR',
					smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.blue },
					itemStyle: { color: C.blue },
					z: 2,
				},
			],
		}, true);
	}

	function renderValues(days: string[]) {
		const acuteValues = history.map(d => Math.round(d.acute_load));
		const chronicValues = history.map(d => Math.round(d.chronic_load));

		// Optimal band: acute should be between chronic * 0.8 and chronic * 1.3
		const bandMin = history.map(d => Math.round(d.chronic_load * ACWR_MIN));
		const bandMax = history.map(d => Math.round(d.chronic_load * ACWR_MAX));

		const hideAcute = hiddenSeries.has('acute');
		const hideChronic = hiddenSeries.has('chronic');
		const hideOptimal = hiddenSeries.has('optimal');
		const nil = history.map(() => null);

		_chart.setOption({
			grid: { top: 8, right: 0, bottom: 30, left: 0, containLabel: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (_params: any) => {
					if (!Array.isArray(_params) || _params.length === 0) return '';
					const idx = _params[0].dataIndex;
					const d = history[idx];
					let html = `<b>${_params[0].axisValueLabel}</b><br/><table style="border-spacing:8px 1px">`;
					html += `<tr><td>${dot(C.blue)}Acute&nbsp;</td><td style="text-align:right"><b>${Math.round(d.acute_load)}</b>&nbsp;</td><td style="color:${C.textDim}">7d</td></tr>`;
					html += `<tr><td>${dot(C.teal, 0.4)}Chronic&nbsp;</td><td style="text-align:right">${Math.round(d.chronic_load)}&nbsp;</td><td style="color:${C.textDim}">28d</td></tr>`;
					html += `<tr><td>${dot(C.green, 0.5)}Optimal&nbsp;</td><td style="text-align:right"><b>${bandMin[idx]}–${bandMax[idx]}</b>&nbsp;</td><td></td></tr>`;
					html += '</table>';
					return html;
				},
			},
			legend: { show: false },
			xAxis: { type: 'category', data: days, boundaryGap: false, ...CHART_AXIS, axisLabel: { ...CHART_AXIS.axisLabel, showMinLabel: false, showMaxLabel: false } },
			yAxis: {
				type: 'value',
				axisLine: { show: false },
				axisLabel: CHART_AXIS.axisLabel,
				splitLine: CHART_AXIS.splitLine,
			},
			series: [
				{
					type: 'line', data: hideOptimal ? nil : bandMin, name: '_bandMin',
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: 'transparent' },
					z: 1,
				},
				{
					type: 'line', data: hideOptimal ? nil : bandMax.map((v, i) => v - bandMin[i]), name: '_bandMax',
					stack: 'band', smooth: true, symbol: 'none',
					lineStyle: { width: 1, type: 'dashed', color: C.green + '60' },
					itemStyle: { color: 'transparent' },
					areaStyle: { color: C.green + '18' },
					z: 1,
				},
				{
					type: 'line', data: hideChronic ? nil : chronicValues, name: 'Chronic',
					smooth: true, symbol: 'none',
					lineStyle: { width: 1.5, color: C.teal + '40' },
					itemStyle: { color: C.teal },
					z: 2,
				},
				{
					type: 'line', data: hideAcute ? nil : acuteValues, name: 'Acute',
					smooth: true, symbol: 'none',
					lineStyle: { width: 2, color: C.blue },
					itemStyle: { color: C.blue },
					z: 3,
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
		history; mode; hiddenSeries;
		renderChart();
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="flex flex-wrap items-center justify-between gap-y-1 mb-2">
		<div class="flex items-center gap-2">
			<Tip text={"Blue = 7-day acute load\nTeal = 28-day chronic load\nGreen band = optimal acute range (ACWR 0.8–1.3)\n\nACWR = acute / chronic"}>
				<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartLineUp size={14} weight="bold" /> ACWR Trend</h2>
			</Tip>
			<div class="flex rounded-md border border-card-border text-[10px] font-medium">
				<button
					class="cursor-pointer px-2 py-0.5 rounded-l-md transition-colors {mode === 'values' ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => mode = 'values'}
				>Load</button>
				<button
					class="cursor-pointer px-2 py-0.5 rounded-r-md transition-colors {mode === 'ratio' ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => mode = 'ratio'}
				>Ratio</button>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
			{#if mode === 'ratio'}
				<Tip text={RATIO_LEGEND.tip}>
					<button
						class="flex items-center gap-1 cursor-pointer transition-opacity {hiddenSeries.has('acute') ? 'opacity-30' : 'text-text-secondary'}"
						onclick={() => toggleSeries('acute')}
					>
						<span class="inline-block w-2.5 h-0.5 rounded-full" style="background:{RATIO_LEGEND.color}"></span>
						{RATIO_LEGEND.name}
					</button>
				</Tip>
			{:else}
				{#each LEGEND_KEYS.filter(k => LEGEND_META[k].modes.includes('values') && k !== 'optimal') as key}
					<Tip text={LEGEND_META[key].tip}>
						<button
							class="flex items-center gap-1 cursor-pointer transition-opacity {hiddenSeries.has(key) ? 'opacity-30' : 'text-text-secondary'}"
							onclick={() => toggleSeries(key)}
						>
							<span class="inline-block w-2.5 h-0.5 rounded-full" style="background:{LEGEND_META[key].color}{LEGEND_META[key].opacity ? `; opacity:${LEGEND_META[key].opacity}` : ''}"></span>
							{LEGEND_META[key].name}
						</button>
					</Tip>
				{/each}
			{/if}
			<Tip text={LEGEND_META.optimal.tip}>
				<button
					class="flex items-center gap-1 cursor-pointer transition-opacity {hiddenSeries.has('optimal') ? 'opacity-30' : 'text-text-secondary'}"
					onclick={() => toggleSeries('optimal')}
				>
					<span class="inline-block w-2.5 h-0.5 rounded-full" style="background:{LEGEND_META.optimal.color}"></span>
					{LEGEND_META.optimal.name}
				</button>
			</Tip>
		</div>
	</div>
	<div bind:this={chartEl} class="flex-1 min-h-[160px] w-full"></div>
</div>
