<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ActivityDetailPoint } from '$lib/types.js';
	import { C, CHART_TOOLTIP, CHART_AXIS } from '$lib/colors.js';

	interface Props {
		timeseries: ActivityDetailPoint[];
		showGap?: boolean;
		group?: string;
	}

	let { timeseries, showGap = false, group }: Props = $props();
	let chartEl: HTMLDivElement;

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

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

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		if (group) { _chart.group = group; echarts.connect(group); }

		// Sample every ~50m (same as ElevationChart)
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
		const xMax = Math.ceil(totalKm / kmStep) * kmStep;

		const paceData = sampled.map(p => [p.dist / 1000, p.pace]);
		const gapData = sampled.map(p => [p.dist / 1000, p.gap]);
		const hrData = sampled.map(p => [p.dist / 1000, p.hr]);
		const powerData = sampled.map(p => [p.dist / 1000, p.power]);
		const cadenceData = sampled.map(p => [p.dist / 1000, p.cadence]);

		const hasPower = sampled.some(p => p.power != null && p.power > 0);
		const hasCadence = sampled.some(p => p.cadence != null && p.cadence > 0);
		const hasGap = showGap && sampled.some(p => p.gap != null && p.gap > 0);

		const allPaces = sampled.map(p => p.pace).filter((p): p is number => p != null && p > 120 && p < 900);
		if (hasGap) allPaces.push(...sampled.map(p => p.gap).filter((p): p is number => p != null && p > 120 && p < 900));
		const rawPaceMin = allPaces.length > 0 ? Math.min(...allPaces) : 200;
		const rawPaceMax = allPaces.length > 0 ? Math.max(...allPaces) : 500;
		const paceStep = niceInterval(rawPaceMax - rawPaceMin);
		const paceMin = paceFloor(rawPaceMin - paceStep * 0.3, paceStep);
		const paceMax = paceCeil(rawPaceMax + paceStep * 0.3, paceStep);

		const allHrs = sampled.map(p => p.hr).filter((h): h is number => h != null && h > 0);
		const hrMin = allHrs.length > 0 ? Math.floor((Math.min(...allHrs) - 5) / 10) * 10 : 100;
		const hrMax = allHrs.length > 0 ? Math.ceil((Math.max(...allHrs) + 5) / 10) * 10 : 180;

		const allPowers = sampled.map(p => p.power).filter((p): p is number => p != null && p > 0);
		const pwrMin = allPowers.length > 0 ? Math.floor((Math.min(...allPowers) - 20) / 50) * 50 : 0;
		const pwrMax = allPowers.length > 0 ? Math.ceil((Math.max(...allPowers) + 20) / 50) * 50 : 500;

		const allCadences = sampled.map(p => p.cadence).filter((c): c is number => c != null && c > 0);
		const cadMin = allCadences.length > 0 ? Math.floor((Math.min(...allCadences) - 5) / 10) * 10 : 140;
		const cadMax = allCadences.length > 0 ? Math.ceil((Math.max(...allCadences) + 5) / 10) * 10 : 200;

		const series: any[] = [];

		series.push({
			type: 'line', name: 'Pace', yAxisIndex: 0,
			data: paceData, smooth: true, symbol: 'none',
			lineStyle: { width: 2, color: C.blue }, itemStyle: { color: C.blue }, z: 4,
		});

		if (hasGap) {
			series.push({
				type: 'line', name: 'GAP', yAxisIndex: 0,
				data: gapData, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.teal, type: 'dashed' }, itemStyle: { color: C.teal }, z: 3,
			});
		}

		series.push({
			type: 'line', name: 'HR', yAxisIndex: 1,
			data: hrData, smooth: true, symbol: 'none',
			lineStyle: { width: 2, color: C.red }, itemStyle: { color: C.red }, z: 3,
		});

		if (hasPower) {
			series.push({
				type: 'line', name: 'Power', yAxisIndex: 2,
				data: powerData, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.amber, type: 'dashed' }, itemStyle: { color: C.amber }, z: 2,
			});
		}

		if (hasCadence) {
			series.push({
				type: 'line', name: 'Cadence', yAxisIndex: 3,
				data: cadenceData, smooth: true, symbol: 'none',
				lineStyle: { width: 1.5, color: C.purple, type: 'dashed' }, itemStyle: { color: C.purple }, z: 2,
			});
		}

		_chart.setOption({
			grid: { top: 32, right: 8, bottom: 24, left: 40 },
			legend: {
				data: series.map(s => ({ name: s.name, itemStyle: { color: s.itemStyle?.color ?? C.green } })),
				selected: { 'Pace': true, 'GAP': true, 'HR': true, 'Power': false, 'Cadence': false },
				top: 2,
				textStyle: { color: C.textSecondary, fontSize: 10 },
			},
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				formatter(params: any) {
					if (!Array.isArray(params) || params.length === 0) return '';
					let html = `<b>${params[0].data[0].toFixed(1)} km</b><br/>`;
					for (const p of params) {
						if (p.data[1] == null) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`;
						let val = '';
						if (p.seriesName === 'Pace' || p.seriesName === 'GAP') val = `${paceStr(p.data[1])} /km`;
						else if (p.seriesName === 'HR') val = `${Math.round(p.data[1])} bpm`;
						else if (p.seriesName === 'Power') val = `${Math.round(p.data[1])}W`;
						else if (p.seriesName === 'Cadence') val = `${Math.round(p.data[1])} spm`;
						html += `${dot}${p.seriesName}: <b>${val}</b><br/>`;
					}
					return html;
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
			yAxis: [
				{
					type: 'value', min: paceMin, max: paceMax, interval: paceStep, inverse: true,
					axisLine: { show: false },
					axisLabel: { color: C.textDim, fontSize: 10, formatter: (v: number) => paceStr(v) },
					splitLine: CHART_AXIS.splitLine,
				},
				{ type: 'value', min: hrMin, max: hrMax, show: false },
				{ type: 'value', min: pwrMin, max: pwrMax, show: false },
				{ type: 'value', min: cadMin, max: cadMax, show: false },
			],
			series,
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div bind:this={chartEl} class="h-[200px] w-full"></div>
