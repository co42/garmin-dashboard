<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ActivityDetailPoint } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS, GRADIENT_COLORS, MONO, arrMin, arrMax } from '$lib/colors.js';
	import { bindTooltipOutsideClick } from '$lib/echarts-helpers.js';

	interface Props {
		timeseries: ActivityDetailPoint[];
		showGap?: boolean;
		showElevation?: boolean;
	}

	let { timeseries, showGap = false, showElevation = false }: Props = $props();
	let chartEl: HTMLDivElement;

	let _chart: any; let _ro: ResizeObserver;
	let _elevSegColors: string[] = [];
	let _totalSeries = 0;
	let _unbindTooltip: (() => void) | null = null;
	onDestroy(() => { _unbindTooltip?.(); _ro?.disconnect(); _chart?.dispose(); });

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
		if (!_chart || _elevSegColors.length === 0) return;
		const updates: any[] = _elevSegColors.map(sc => {
			const on = color === null || sc === color;
			return { lineStyle: { opacity: on ? 1 : 0.15 }, areaStyle: { opacity: on ? 0.45 : 0.08 } };
		});
		while (updates.length < _totalSeries) updates.push({});
		_chart.setOption({ series: updates });
	}

	// Legend state managed in HTML
	type LegendItem = { name: string; color: string };
	let legendItems = $state<LegendItem[]>([]);
	let legendSelected = $state<Record<string, boolean>>({});

	function toggleLegend(name: string) {
		legendSelected[name] = !legendSelected[name];
		_chart?.dispatchAction({ type: 'legendToggleSelect', name });
	}

	function paceStr(sec: number): string {
		if (!sec || sec <= 0 || sec > 1200) return '-';
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function paceFloor(sec: number, step: number): number { return Math.floor(sec / step) * step; }
	function paceCeil(sec: number, step: number): number { return Math.ceil(sec / step) * step; }

	function niceInterval(range: number): number {
		if (range <= 60) return 15;
		if (range <= 150) return 30;
		if (range <= 360) return 60;
		return 120;
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
		_unbindTooltip = bindTooltipOutsideClick(_chart, chartEl);

		// Sample every ~50m
		const sampled: ActivityDetailPoint[] = [];
		let nextDist = 0;
		for (const p of timeseries) {
			if (p.dist >= nextDist) {
				sampled.push(p);
				nextDist = p.dist + 50;
			}
		}
		if (sampled.length === 0) return;

		const totalKm = sampled[sampled.length - 1].dist / 1000;
		const kmStep = totalKm > 50 ? 5 : totalKm > 25 ? 2 : 1;
		const xMax = Math.round(totalKm * 10) / 10;

		// Common x-axis config
		const xAxisBase = {
			type: 'value' as const,
			min: 0,
			max: xMax,
			interval: kmStep,
			...CHART_AXIS,
			axisLabel: { ...CHART_AXIS.axisLabel, formatter: (v: number) => `${v}` },
		};

		// ── Elevation data ──
		const elevPoints: { km: number; elev: number; grad: number }[] = [];
		if (showElevation) {
			for (let i = 0; i < sampled.length; i++) {
				const p = sampled[i];
				if (p.elev == null) continue;
				let grad = 0;
				if (i > 0 && sampled[i - 1].elev != null) {
					const dDist = p.dist - sampled[i - 1].dist;
					if (dDist > 0) grad = ((p.elev - sampled[i - 1].elev!) / dDist) * 100;
				}
				elevPoints.push({ km: p.dist / 1000, elev: p.elev, grad: Math.round(grad * 10) / 10 });
			}
		}
		const hasElev = elevPoints.length > 2;

		// ── Performance data ──
		const paceData = sampled.map(p => [p.dist / 1000, p.pace]);
		const gapData = sampled.map(p => [p.dist / 1000, p.gap]);
		const hrData = sampled.map(p => [p.dist / 1000, p.hr]);
		const powerData = sampled.map(p => [p.dist / 1000, p.power]);
		const cadenceData = sampled.map(p => [p.dist / 1000, p.cadence]);

		const hasPower = sampled.some(p => p.power != null && p.power > 0);
		const hasCadence = sampled.some(p => p.cadence != null && p.cadence > 0);
		const hasGap = showGap && sampled.some(p => p.gap != null && p.gap > 0);

		// Pace range
		const allPaces = sampled.map(p => p.pace).filter((p): p is number => p != null && p > 120 && p < 900);
		if (hasGap) allPaces.push(...sampled.map(p => p.gap).filter((p): p is number => p != null && p > 120 && p < 900));
		const rawPaceMin = allPaces.length > 0 ? arrMin(allPaces) : 200;
		const rawPaceMax = allPaces.length > 0 ? arrMax(allPaces) : 500;
		const paceStep = niceInterval(rawPaceMax - rawPaceMin);
		const paceMin = paceFloor(rawPaceMin - paceStep * 0.3, paceStep);
		const paceMax = paceCeil(rawPaceMax + paceStep * 0.3, paceStep);

		const allHrs = sampled.map(p => p.hr).filter((h): h is number => h != null && h > 0);
		const hrMin = allHrs.length > 0 ? Math.floor((arrMin(allHrs) - 5) / 10) * 10 : 100;
		const hrMax = allHrs.length > 0 ? Math.ceil((arrMax(allHrs) + 5) / 10) * 10 : 180;

		const allPowers = sampled.map(p => p.power).filter((p): p is number => p != null && p > 0);
		const pwrMin = allPowers.length > 0 ? Math.floor((arrMin(allPowers) - 20) / 50) * 50 : 0;
		const pwrMax = allPowers.length > 0 ? Math.ceil((arrMax(allPowers) + 20) / 50) * 50 : 500;

		const allCadences = sampled.map(p => p.cadence).filter((c): c is number => c != null && c > 0);
		const cadMin = allCadences.length > 0 ? Math.floor((arrMin(allCadences) - 5) / 10) * 10 : 140;
		const cadMax = allCadences.length > 0 ? Math.ceil((arrMax(allCadences) + 5) / 10) * 10 : 200;

		// ── Layout: elevation on top, performance below ──
		// If no elevation, performance takes full height
		const elevHeight = hasElev ? '30%' : '0%';
		const perfTop = hasElev ? '38%' : 8;

		const grids: any[] = [];
		const xAxes: any[] = [];
		const yAxes: any[] = [];
		const series: any[] = [];

		if (hasElev) {
			const elevs = elevPoints.map(p => p.elev);
			const elevMin = arrMin(elevs);
			const elevMax = arrMax(elevs);
			const elevPad = Math.max((elevMax - elevMin) * 0.1, 5);

			// Grid 0: elevation
			grids.push({ top: 8, right: 8, bottom: '62%', left: 40 });

			// xAxis 0: elevation (hidden labels, shared range)
			xAxes.push({ ...xAxisBase, gridIndex: 0, axisLabel: { show: false }, axisTick: { show: false } });

			// yAxis 0: elevation
			yAxes.push({
				type: 'value',
				gridIndex: 0,
				min: Math.floor(elevMin - elevPad),
				max: Math.ceil(elevMax + elevPad),
				axisLine: { show: false },
				axisLabel: { color: C.textDim, fontSize: 10, fontFamily: MONO, formatter: (v: number) => `${v}m` },
				splitLine: CHART_AXIS.splitLine,
			});

			// Colored segments
			const segments: { color: string; data: [number, number][] }[] = [];
			let curColor = gradColor(elevPoints[0].grad);
			let curData: [number, number][] = [[elevPoints[0].km, elevPoints[0].elev]];
			for (let i = 1; i < elevPoints.length; i++) {
				const c = gradColor(elevPoints[i].grad);
				if (c !== curColor) {
					segments.push({ color: curColor, data: curData });
					curColor = c;
					curData = [[elevPoints[i - 1].km, elevPoints[i - 1].elev]];
				}
				curData.push([elevPoints[i].km, elevPoints[i].elev]);
			}
			segments.push({ color: curColor, data: curData });
			_elevSegColors = segments.map(s => s.color);

			for (const seg of segments) {
				series.push({
					type: 'line',
					xAxisIndex: 0, yAxisIndex: 0,
					data: seg.data,
					smooth: true,
					symbol: 'none',
					lineStyle: { width: 1.5, color: seg.color },
					areaStyle: { opacity: 0.45, color: seg.color },
					silent: true,
				});
			}

			// Invisible full-data series for tooltip
			series.push({
				type: 'line',
				name: '_elev',
				xAxisIndex: 0, yAxisIndex: 0,
				data: elevPoints.map(p => [p.km, p.elev, p.grad]),
				symbol: 'none',
				lineStyle: { width: 0, color: 'transparent' },
				z: 10,
			});
		}

		// Grid 1 (or 0 if no elev): performance
		const perfGridIndex = hasElev ? 1 : 0;
		grids.push({ top: perfTop, right: 8, bottom: 24, left: 40 });

		// xAxis for performance (with labels)
		xAxes.push({ ...xAxisBase, gridIndex: perfGridIndex });

		// yAxes for performance
		const paceYIdx = yAxes.length;
		yAxes.push({
			type: 'value', gridIndex: perfGridIndex,
			min: paceMin, max: paceMax, interval: paceStep, inverse: true,
			axisLine: { show: false },
			axisLabel: { color: C.textDim, fontSize: 10, fontFamily: MONO, formatter: (v: number) => paceStr(v) },
			splitLine: CHART_AXIS.splitLine,
		});
		const hrYIdx = yAxes.length;
		yAxes.push({ type: 'value', gridIndex: perfGridIndex, min: hrMin, max: hrMax, show: false });
		const pwrYIdx = yAxes.length;
		yAxes.push({ type: 'value', gridIndex: perfGridIndex, min: pwrMin, max: pwrMax, show: false });
		const cadYIdx = yAxes.length;
		yAxes.push({ type: 'value', gridIndex: perfGridIndex, min: cadMin, max: cadMax, show: false });

		const perfXIdx = hasElev ? 1 : 0;

		series.push({
			type: 'line', name: 'Pace', xAxisIndex: perfXIdx, yAxisIndex: paceYIdx,
			data: paceData, smooth: true, symbol: 'none',
			lineStyle: { width: 2, color: C.blue }, itemStyle: { color: C.blue }, z: 4,
		});

		if (hasGap) {
			series.push({
				type: 'line', name: 'GAP', xAxisIndex: perfXIdx, yAxisIndex: paceYIdx,
				data: gapData, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.teal, type: 'dashed' }, itemStyle: { color: C.teal }, z: 3,
			});
		}

		series.push({
			type: 'line', name: 'HR', xAxisIndex: perfXIdx, yAxisIndex: hrYIdx,
			data: hrData, smooth: true, symbol: 'none',
			lineStyle: { width: 2, color: C.red }, itemStyle: { color: C.red }, z: 3,
		});

		if (hasPower) {
			series.push({
				type: 'line', name: 'Power', xAxisIndex: perfXIdx, yAxisIndex: pwrYIdx,
				data: powerData, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.amber, type: 'dashed' }, itemStyle: { color: C.amber }, z: 2,
			});
		}

		if (hasCadence) {
			series.push({
				type: 'line', name: 'Cadence', xAxisIndex: perfXIdx, yAxisIndex: cadYIdx,
				data: cadenceData, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.purple, type: 'dashed' }, itemStyle: { color: C.purple }, z: 2,
			});
		}

		// Legend items (exclude internal series)
		_totalSeries = series.length;
		const defaultSelected: Record<string, boolean> = { 'Pace': true, 'GAP': true, 'HR': true, 'Power': false, 'Cadence': false };
		legendItems = series
			.filter(s => s.name && !s.name.startsWith('_') && !s.silent)
			.map(s => ({ name: s.name, color: s.itemStyle?.color ?? C.green }));
		legendSelected = Object.fromEntries(legendItems.map(l => [l.name, defaultSelected[l.name] ?? true]));

		_chart.setOption({
			grid: grids,
			axisPointer: {
				link: [{ xAxisIndex: hasElev ? [0, 1] : [0] }],
			},
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				formatter(params: any) {
					if (!Array.isArray(params) || params.length === 0) return '';
					const km = params[0].data[0];
					let html = `<b>${km.toFixed(1)} km</b><br/>`;

					// Elevation info
					const elevParam = params.find((p: any) => p.seriesName === '_elev');
					if (elevParam?.data?.[2] != null) {
						const elev = elevParam.data[1];
						const grad = elevParam.data[2];
						const sign = grad >= 0 ? '+' : '';
						html += `Elev: <b>${Math.round(elev)}m</b> (${sign}${grad}%)<br/>`;
					}

					// Performance info
					for (const p of params) {
						if (p.data[1] == null || p.seriesName?.startsWith('_') || p.silent) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`;
						let val = '';
						if (p.seriesName === 'Pace' || p.seriesName === 'GAP') val = `${paceStr(p.data[1])} /km`;
						else if (p.seriesName === 'HR') val = `${Math.round(p.data[1])} bpm`;
						else if (p.seriesName === 'Power') val = `${Math.round(p.data[1])}W`;
						else if (p.seriesName === 'Cadence') val = `${Math.round(p.data[1])} spm`;
						if (val) html += `${dot}${p.seriesName}: <b>${val}</b><br/>`;
					}
					return html;
				},
			},
			legend: { show: false, selected: legendSelected },
			xAxis: xAxes,
			yAxis: yAxes,
			series,
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="flex flex-wrap items-center justify-between gap-y-1 mb-1 text-[9px] text-text-dim">
	<div class="flex items-center gap-2">
		{#each legendItems as item}
			<button
				class="flex items-center gap-1 cursor-pointer transition-opacity {legendSelected[item.name] ? '' : 'opacity-30'}"
				onclick={() => toggleLegend(item.name)}
			>
				<span class="inline-block w-2.5 h-0.5 rounded-full" style="background:{item.color}"></span>
				{item.name}
			</button>
		{/each}
	</div>
	{#if showElevation}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="hidden md:flex items-center gap-2" onmouseleave={() => highlightGrad(null)}>
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
	{/if}
</div>
<div bind:this={chartEl} class="{showElevation ? 'h-[340px]' : 'h-[200px]'} w-full"></div>
