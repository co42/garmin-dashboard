<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Activity, HrZone } from '$lib/types.js';
	import { weekMonday, utcDate, fmtDateISO } from '$lib/dates.js';
	import { C, ZONE_COLORS, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import ChartBar from 'phosphor-svelte/lib/ChartBar';

	interface Props {
		activities: Activity[];
		hrZones: HrZone[];
		maxHr: number | null;
	}

	let { activities, hrZones, maxHr }: Props = $props();
	let chartEl: HTMLDivElement;
	let mode = $state<'hr' | 'power'>('hr');

	const ZONE_KEYS = [0, 1, 2, 3, 4] as const;
	type ZoneKey = typeof ZONE_KEYS[number];

	const zoneLabels = $derived(
		ZONE_KEYS.map(z => {
			const hz = hrZones.find(h => h.zone === z + 1);
			return hz ? `Z${z + 1} ${hz.min_bpm}–${hz.max_bpm == null ? (maxHr ?? '∞') : hz.max_bpm}` : `Z${z + 1}`;
		})
	);

	const ZONE_NAMES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

	let hiddenZones = $state(new Set<ZoneKey>());

	function toggleZone(key: ZoneKey) {
		const next = new Set(hiddenZones);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		hiddenZones = next;
		renderChart();
	}

	// --- Data ---

	interface WeekData {
		week: string;
		label: string;
		totalKm: number;
		runs: number;
		zoneKm: number[]; // 5 zones
	}

	function getZoneTimes(a: Activity, m: 'hr' | 'power'): number[] {
		if (m === 'hr') {
			return [
				a.hr_time_in_zone_1 ?? 0,
				a.hr_time_in_zone_2 ?? 0,
				a.hr_time_in_zone_3 ?? 0,
				a.hr_time_in_zone_4 ?? 0,
				a.hr_time_in_zone_5 ?? 0,
			];
		}
		return [
			a.power_time_in_zone_1 ?? 0,
			a.power_time_in_zone_2 ?? 0,
			a.power_time_in_zone_3 ?? 0,
			a.power_time_in_zone_4 ?? 0,
			a.power_time_in_zone_5 ?? 0,
		];
	}

	function computeWeeks(m: 'hr' | 'power'): WeekData[] {
		const weeks = new Map<string, { totalKm: number; runs: number; zoneKm: number[] }>();

		for (const a of activities) {
			const week = weekMonday(a.start_time);
			const existing = weeks.get(week) ?? { totalKm: 0, runs: 0, zoneKm: [0, 0, 0, 0, 0] };
			const km = a.distance_meters / 1000;
			existing.totalKm += km;
			existing.runs++;

			const times = getZoneTimes(a, m);
			const totalTime = times.reduce((s, v) => s + v, 0);
			if (totalTime > 0) {
				for (let z = 0; z < 5; z++) {
					existing.zoneKm[z] += km * (times[z] / totalTime);
				}
			} else {
				// No zone data — attribute all to Z1
				existing.zoneKm[0] += km;
			}
			weeks.set(week, existing);
		}

		const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		if (sorted.length === 0) return [];

		const result: WeekData[] = [];
		const start = utcDate(sorted[0][0]);
		const end = utcDate(sorted[sorted.length - 1][0]);

		for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
			const key = fmtDateISO(d);
			const dt = utcDate(key);
			const label = `${dt.getUTCDate()} ${dt.toLocaleDateString('en-GB', { month: 'short' })}`;
			const data = weeks.get(key);
			result.push({
				week: key, label,
				totalKm: data?.totalKm ?? 0,
				runs: data?.runs ?? 0,
				zoneKm: data?.zoneKm ?? [0, 0, 0, 0, 0],
			});
		}
		return result;
	}

	const stats = $derived(() => {
		const data = computeWeeks(mode);
		const activeWeeks = data.filter(d => d.totalKm > 0);
		const totalKm = data.reduce((s, d) => s + d.totalKm, 0);
		const totalRuns = data.reduce((s, d) => s + d.runs, 0);
		const avgKm = activeWeeks.length > 0 ? totalKm / activeWeeks.length : 0;
		return { totalKm: Math.round(totalKm), totalRuns, avgKm: Math.round(avgKm) };
	});

	// --- Chart ---

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	function renderChart() {
		if (!_chart) return;
		const data = computeWeeks(mode);
		const labels = data.map(d => d.label);

		const series = ZONE_KEYS.map(z => ({
			type: 'bar' as const,
			name: ZONE_NAMES[z],
			stack: 'total',
			data: data.map(d => hiddenZones.has(z) ? 0 : Math.round(d.zoneKm[z] * 10) / 10),
			itemStyle: { color: ZONE_COLORS[z] },
			barWidth: '65%',
			emphasis: { focus: 'series' as const },
		}));

		_chart.setOption({
			grid: { top: 30, right: 16, bottom: 30, left: 45 },
			legend: { show: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					const idx = params[0].dataIndex;
					const d = data[idx];
					if (d.totalKm <= 0) return '';
					let html = `<b>${d.label}</b> · ${d.runs} run${d.runs > 1 ? 's' : ''} · ${Math.round(d.totalKm)}km<br/><table style="border-spacing:8px 1px">`;
					for (const p of params) {
						if (p.value <= 0) continue;
						const pct = Math.round((p.value / d.totalKm) * 100);
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:2px"></span>`;
						html += `<tr><td>${dot}${p.seriesName}&nbsp;</td><td style="text-align:right"><b>${p.value}</b>km&nbsp;</td><td style="color:${C.textDim}">${pct}%</td></tr>`;
					}
					html += '</table>';
					return html;
				},
			},
			xAxis: {
				type: 'category', data: labels,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, rotate: 30 },
			},
			yAxis: {
				type: 'value',
				axisLine: { show: false },
				axisLabel: { ...CHART_AXIS.axisLabel, formatter: (v: number) => `${Math.round(v)}` },
				splitLine: CHART_AXIS.splitLine,
			},
			series,
		}, true);
	}

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		renderChart();
		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});

	$effect(() => { mode; renderChart(); });
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="mb-2">
		<div class="flex items-center gap-2">
			<Tip text={"Weekly running distance split by zone.\nDistance is proportionally allocated based on time spent in each zone.\n\nToggle between HR zones and Power zones."}>
				<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartBar size={14} weight="bold" /> Weekly Volume</h2>
			</Tip>
			<div class="flex rounded-md border border-card-border text-[10px] font-medium">
				<button
					class="cursor-pointer px-2 py-0.5 rounded-l-md transition-colors {mode === 'hr' ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => mode = 'hr'}
				>HR</button>
				<button
					class="cursor-pointer px-2 py-0.5 rounded-r-md transition-colors {mode === 'power' ? 'bg-blue-500/20 text-blue-400' : 'text-text-dim hover:text-text-secondary'}"
					onclick={() => mode = 'power'}
				>Power</button>
			</div>
		</div>
		<div class="flex items-center gap-3 text-[10px] num mt-1">
			<span class="text-text-secondary"><b class="text-text">{stats().totalRuns}</b> runs</span>
			<span class="text-text-secondary"><b class="text-text">{stats().totalKm}</b> km</span>
			<span class="text-text-secondary">avg <b class="text-text">{stats().avgKm}</b> km/wk</span>
		</div>
	</div>
	<div bind:this={chartEl} class="flex-1 min-h-[160px] w-full"></div>
</div>
