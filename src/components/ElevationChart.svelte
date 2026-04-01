<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ActivityDetailPoint } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, GRADIENT_COLORS } from '$lib/colors.js';

	interface Props {
		timeseries: ActivityDetailPoint[];
		group?: string;
	}

	let { timeseries, group }: Props = $props();
	let chartEl: HTMLDivElement;

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function gradColor(grad: number): string {
		if (grad < -8) return GRADIENT_COLORS.steepDown;
		if (grad < -2) return GRADIENT_COLORS.modDown;
		if (grad < 2) return GRADIENT_COLORS.flat;
		if (grad < 8) return GRADIENT_COLORS.modUp;
		if (grad < 15) return GRADIENT_COLORS.steepUp;
		return GRADIENT_COLORS.vSteepUp;
	}

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		if (group) { _chart.group = group; echarts.connect(group); }

		// Sample every ~50m
		const sampled: ActivityDetailPoint[] = [];
		let nextDist = 0;
		for (const p of timeseries) {
			if (p.dist >= nextDist) {
				sampled.push(p);
				nextDist = p.dist + 50;
			}
		}
		if (sampled.length < 3) return;

		const points: { km: number; elev: number; grad: number }[] = [];
		for (let i = 0; i < sampled.length; i++) {
			const p = sampled[i];
			if (p.elev == null) continue;
			let grad = 0;
			if (i > 0 && sampled[i - 1].elev != null) {
				const dDist = p.dist - sampled[i - 1].dist;
				if (dDist > 0) grad = ((p.elev - sampled[i - 1].elev!) / dDist) * 100;
			}
			points.push({ km: p.dist / 1000, elev: p.elev, grad: Math.round(grad * 10) / 10 });
		}
		if (points.length === 0) return;

		const elevs = points.map(p => p.elev);
		const elevMin = Math.min(...elevs);
		const elevMax = Math.max(...elevs);
		const elevPad = Math.max((elevMax - elevMin) * 0.1, 5);
		const totalKm = points[points.length - 1].km;
		const kmStep = totalKm > 50 ? 5 : totalKm > 25 ? 2 : 1;
		const xMax = Math.ceil(totalKm / kmStep) * kmStep;

		// Split into colored segments
		const segments: { color: string; data: [number, number][] }[] = [];
		let curColor = gradColor(points[0].grad);
		let curData: [number, number][] = [[points[0].km, points[0].elev]];
		for (let i = 1; i < points.length; i++) {
			const c = gradColor(points[i].grad);
			if (c !== curColor) {
				segments.push({ color: curColor, data: curData });
				curColor = c;
				curData = [[points[i - 1].km, points[i - 1].elev]];
			}
			curData.push([points[i].km, points[i].elev]);
		}
		segments.push({ color: curColor, data: curData });

		const series: any[] = segments.map((seg) => ({
			type: 'line',
			data: seg.data,
			smooth: true,
			symbol: 'none',
			lineStyle: { width: 1.5, color: seg.color },
			areaStyle: { opacity: 0.45, color: seg.color },
			silent: true,
		}));

		// Invisible full-data series for tooltip
		series.push({
			type: 'line',
			data: points.map(p => [p.km, p.elev, p.grad]),
			symbol: 'none',
			lineStyle: { width: 0, color: 'transparent' },
			silent: false,
			z: 10,
		});

		_chart.setOption({
			grid: { top: 8, right: 8, bottom: 24, left: 40 },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				formatter(params: any) {
					if (!Array.isArray(params) || params.length === 0) return '';
					const p = params.find((x: any) => x.data?.length === 3) ?? params[0];
					const km = p.data[0];
					const elev = p.data[1];
					const grad = p.data[2] ?? 0;
					const sign = grad >= 0 ? '+' : '';
					return `<b>${km.toFixed(1)} km</b><br/>Elevation: <b>${Math.round(elev)}m</b><br/>Gradient: <b>${sign}${grad}%</b>`;
				},
			},
			xAxis: {
				type: 'value',
				min: 0,
				max: xMax,
				interval: kmStep,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, formatter: (v: number) => `${v}` },
			},
			yAxis: {
				type: 'value',
				min: Math.floor(elevMin - elevPad),
				max: Math.ceil(elevMax + elevPad),
				axisLine: { show: false },
				axisLabel: { color: C.textDim, fontSize: 10, formatter: (v: number) => `${v}m` },
				splitLine: CHART_AXIS.splitLine,
			},
			series,
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="flex items-center justify-center gap-3 mb-1 text-[9px] text-text-dim">
	<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-1.5 rounded-sm" style="background:{GRADIENT_COLORS.steepDown}"></span>&lt;-8%</span>
	<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-1.5 rounded-sm" style="background:{GRADIENT_COLORS.modDown}"></span>-8/-2%</span>
	<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-1.5 rounded-sm" style="background:{GRADIENT_COLORS.flat}"></span>flat</span>
	<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-1.5 rounded-sm" style="background:{GRADIENT_COLORS.modUp}"></span>2/8%</span>
	<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-1.5 rounded-sm" style="background:{GRADIENT_COLORS.steepUp}"></span>8/15%</span>
	<span class="flex items-center gap-1"><span class="inline-block w-2.5 h-1.5 rounded-sm" style="background:{GRADIENT_COLORS.vSteepUp}"></span>&gt;15%</span>
</div>
<div bind:this={chartEl} class="h-[120px] w-full"></div>
