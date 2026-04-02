<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ActivityDetailPoint } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, GRADIENT_COLORS, MONO, arrMin, arrMax } from '$lib/colors.js';

	interface Props {
		timeseries: ActivityDetailPoint[];
		group?: string;
	}

	let { timeseries, group }: Props = $props();
	let chartEl: HTMLDivElement;

	let _chart: any; let _ro: ResizeObserver;
	let _segColors: string[] = [];
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	const gradLegend = [
		{ color: GRADIENT_COLORS.vSteepDown, label: '<15%' },
		{ color: GRADIENT_COLORS.steepDown, label: '-15/-8%' },
		{ color: GRADIENT_COLORS.modDown, label: '-8/-2%' },
		{ color: GRADIENT_COLORS.flat, label: 'flat' },
		{ color: GRADIENT_COLORS.modUp, label: '2/8%' },
		{ color: GRADIENT_COLORS.steepUp, label: '8/15%' },
		{ color: GRADIENT_COLORS.vSteepUp, label: '>15%' },
	];

	function highlightGrad(color: string | null) {
		if (!_chart || _segColors.length === 0) return;
		const updates: any[] = _segColors.map(sc => {
			const on = color === null || sc === color;
			return { lineStyle: { opacity: on ? 1 : 0.15 }, areaStyle: { opacity: on ? 0.45 : 0.08 } };
		});
		updates.push({}); // tooltip series untouched
		_chart.setOption({ series: updates });
	}

	function gradColor(grad: number): string {
		if (grad < -15) return GRADIENT_COLORS.vSteepDown;
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
		const elevMin = arrMin(elevs);
		const elevMax = arrMax(elevs);
		const elevPad = Math.max((elevMax - elevMin) * 0.1, 5);
		const totalKm = points[points.length - 1].km;
		const kmStep = totalKm > 50 ? 5 : totalKm > 25 ? 2 : 1;
		const xMax = Math.round(totalKm * 10) / 10;

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
		_segColors = segments.map(s => s.color);

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
				axisLabel: { color: C.textDim, fontSize: 10, fontFamily: MONO, formatter: (v: number) => `${v}m` },
				splitLine: CHART_AXIS.splitLine,
			},
			series,
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex items-center justify-center gap-3 mb-1 text-[9px] text-text-dim" onmouseleave={() => highlightGrad(null)}>
	{#each gradLegend as { color, label }}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="flex items-center gap-1"
			onmouseenter={() => highlightGrad(color)}
		>
			<span class="inline-block w-2.5 h-1.5 rounded-sm" style="background:{color}"></span>
			{label}
		</span>
	{/each}
</div>
<div bind:this={chartEl} class="h-[120px] w-full"></div>
