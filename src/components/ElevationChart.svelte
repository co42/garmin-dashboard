<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ActivityDetailPoint } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, GRADIENT_COLORS } from '$lib/colors.js';

	interface Props {
		timeseries: ActivityDetailPoint[];
	}

	let { timeseries }: Props = $props();
	let chartEl: HTMLDivElement;

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });

		// Sample every ~50m for smoother elevation profile
		const sampled: ActivityDetailPoint[] = [];
		let nextDist = 0;
		for (const p of timeseries) {
			if (p.dist >= nextDist) {
				sampled.push(p);
				nextDist = p.dist + 50;
			}
		}
		if (sampled.length < 3) return;

		// Compute gradient between consecutive points: [dist_km, elevation, gradient_pct]
		const data: [string, number, number][] = [];
		for (let i = 0; i < sampled.length; i++) {
			const p = sampled[i];
			if (p.elev == null) continue;
			let grad = 0;
			if (i > 0 && sampled[i - 1].elev != null) {
				const dDist = p.dist - sampled[i - 1].dist;
				if (dDist > 0) {
					grad = ((p.elev - sampled[i - 1].elev!) / dDist) * 100;
				}
			}
			data.push([(p.dist / 1000).toFixed(2), p.elev, Math.round(grad * 10) / 10]);
		}

		if (data.length === 0) return;

		const elevs = data.map(d => d[1]);
		const elevMin = Math.min(...elevs);
		const elevMax = Math.max(...elevs);
		const elevPad = Math.max((elevMax - elevMin) * 0.1, 5);

		_chart.setOption({
			grid: { top: 8, right: 8, bottom: 24, left: 44 },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				formatter(params: any) {
					if (!Array.isArray(params) || params.length === 0) return '';
					const p = params[0];
					const elev = p.data[1];
					const grad = p.data[2];
					const sign = grad >= 0 ? '+' : '';
					return `<b>${p.data[0]} km</b><br/>Elevation: <b>${Math.round(elev)}m</b><br/>Gradient: <b>${sign}${grad}%</b>`;
				},
			},
			visualMap: {
				type: 'piecewise',
				show: false,
				dimension: 2, // color by gradient (3rd value in tuple)
				pieces: [
					{ lt: -8, color: GRADIENT_COLORS.steepDown },
					{ gte: -8, lt: -2, color: GRADIENT_COLORS.modDown },
					{ gte: -2, lt: 2, color: GRADIENT_COLORS.flat },
					{ gte: 2, lt: 8, color: GRADIENT_COLORS.modUp },
					{ gte: 8, lt: 15, color: GRADIENT_COLORS.steepUp },
					{ gte: 15, color: GRADIENT_COLORS.vSteepUp },
				],
			},
			xAxis: {
				type: 'category',
				data: data.map(d => d[0]),
				...CHART_AXIS,
				axisLabel: {
					...CHART_AXIS.axisLabel,
					interval: Math.max(1, Math.floor(data.length / 8)),
					formatter: (v: string) => {
						const n = parseFloat(v);
						return n === Math.floor(n) ? `${n}` : '';
					},
				},
				boundaryGap: false,
			},
			yAxis: {
				type: 'value',
				min: Math.floor(elevMin - elevPad),
				max: Math.ceil(elevMax + elevPad),
				axisLine: { show: false },
				axisLabel: { color: C.textDim, fontSize: 10, formatter: (v: number) => `${v}m` },
				splitLine: CHART_AXIS.splitLine,
			},
			series: [{
				type: 'line',
				data: data,
				smooth: true,
				symbol: 'none',
				lineStyle: { width: 1.5 },
				areaStyle: { opacity: 0.3 },
				encode: { x: 0, y: 1 },
			}],
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div bind:this={chartEl} class="h-[120px] w-full"></div>
