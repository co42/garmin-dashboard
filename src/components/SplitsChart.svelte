<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ActivityDetailPoint } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS } from '$lib/colors.js';

	interface Props {
		timeseries: ActivityDetailPoint[];
		showGap?: boolean;
	}

	let { timeseries, showGap = false }: Props = $props();
	let chartEl: HTMLDivElement;

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function paceStr(sec: number): string {
		if (!sec || sec <= 0 || sec > 1200) return '-';
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		// Sample every ~100m by distance
		const sampled: ActivityDetailPoint[] = [];
		let nextDist = 0;
		for (const p of timeseries) {
			if (p.dist >= nextDist) {
				sampled.push(p);
				nextDist = p.dist + 100;
			}
		}
		if (sampled.length === 0) return;

		const dists = sampled.map(p => (p.dist / 1000).toFixed(1));
		const paces = sampled.map(p => p.pace);
		const gaps = sampled.map(p => p.gap);
		const hrs = sampled.map(p => p.hr);
		const powers = sampled.map(p => p.power);
		const cadences = sampled.map(p => p.cadence);

		const hasPower = powers.some(p => p != null && p > 0);
		const hasCadence = cadences.some(c => c != null && c > 0);
		const hasGap = showGap && gaps.some(g => g != null && g > 0);

		// Pace range (filter outliers)
		const allPaces = [...paces, ...(hasGap ? gaps : [])].filter((p): p is number => p != null && p > 120 && p < 900);
		const paceMin = allPaces.length > 0 ? Math.min(...allPaces) : 200;
		const paceMax = allPaces.length > 0 ? Math.max(...allPaces) : 500;
		const pacePad = (paceMax - paceMin) * 0.1 || 15;

		const series: any[] = [];

		// Pace line
		series.push({
			type: 'line', name: 'Pace', yAxisIndex: 0,
			data: paces, smooth: true, symbol: 'none',
			lineStyle: { width: 2, color: C.blue },
			itemStyle: { color: C.blue },
			z: 4,
		});

		// GAP line (when trail)
		if (hasGap) {
			series.push({
				type: 'line', name: 'GAP', yAxisIndex: 0,
				data: gaps, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.teal, type: 'dashed' },
				itemStyle: { color: C.teal },
				z: 3,
			});
		}

		// HR line
		series.push({
			type: 'line', name: 'HR', yAxisIndex: 1,
			data: hrs, smooth: true, symbol: 'none',
			lineStyle: { width: 2, color: C.red },
			itemStyle: { color: C.red },
			z: 3,
		});

		if (hasPower) {
			series.push({
				type: 'line', name: 'Power', yAxisIndex: 1,
				data: powers, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.amber, type: 'dashed' },
				itemStyle: { color: C.amber },
				z: 2,
			});
		}

		if (hasCadence) {
			series.push({
				type: 'line', name: 'Cadence', yAxisIndex: 1,
				data: cadences, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.purple, type: 'dashed' },
				itemStyle: { color: C.purple },
				z: 2,
			});
		}

		const defaultSelected: Record<string, boolean> = {
			'Pace': true, 'GAP': true, 'HR': true,
			'Power': false, 'Cadence': false,
		};

		_chart.setOption({
			grid: { top: 32, right: 8, bottom: 24, left: 40 },
			legend: {
				data: series.map(s => ({ name: s.name, itemStyle: { color: s.itemStyle?.color ?? C.green } })),
				selected: defaultSelected,
				top: 2,
				textStyle: { color: C.textSecondary, fontSize: 10 },
			},
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				formatter(params: any) {
					if (!Array.isArray(params) || params.length === 0) return '';
					let html = `<b>${params[0].axisValueLabel} km</b><br/>`;
					for (const p of params) {
						if (p.value == null) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`;
						let val = '';
						if (p.seriesName === 'Pace' || p.seriesName === 'GAP') val = `${paceStr(p.value)} /km`;
						else if (p.seriesName === 'HR') val = `${Math.round(p.value)} bpm`;
						else if (p.seriesName === 'Power') val = `${Math.round(p.value)}W`;
						else if (p.seriesName === 'Cadence') val = `${Math.round(p.value)} spm`;
						html += `${dot}${p.seriesName}: <b>${val}</b><br/>`;
					}
					return html;
				},
			},
			xAxis: {
				type: 'category', data: dists,
				...CHART_AXIS,
				axisLabel: {
					...CHART_AXIS.axisLabel,
					interval: Math.max(1, Math.floor(dists.length / 8)),
				},
			},
			yAxis: [
				{
					// Pace (inverted — lower = faster)
					type: 'value',
					min: Math.floor(paceMin - pacePad),
					max: Math.ceil(paceMax + pacePad),
					inverse: true,
					axisLine: { show: false },
					axisLabel: { color: C.textDim, fontSize: 10, formatter: (v: number) => paceStr(v) },
					splitLine: CHART_AXIS.splitLine,
				},
				{
					// HR / Power / Cadence (hidden axis)
					type: 'value',
					axisLine: { show: false },
					axisLabel: { show: false },
					splitLine: { show: false },
				},
			],
			series,
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div bind:this={chartEl} class="h-[200px] w-full"></div>
