<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Activity, HrZone } from '$lib/types.js';
	import { C, ZONE_COLORS, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import ChartPieSlice from 'phosphor-svelte/lib/ChartPieSlice';

	interface Props {
		activities: Activity[];
		hrZones: HrZone[];
		maxHr: number | null;
	}

	let { activities, hrZones, maxHr }: Props = $props();

	const zoneLabels = $derived(
		[1, 2, 3, 4, 5].map(z => {
			const hz = hrZones.find(h => h.zone === z);
			return hz ? `Z${z}\n${hz.min_bpm}–${hz.max_bpm == null ? (maxHr ?? '∞') : hz.max_bpm}` : `Z${z}`;
		})
	);

	const zoneBpmTip = $derived(
		[1, 2, 3, 4, 5].map(z => {
			const hz = hrZones.find(h => h.zone === z);
			return hz ? `${hz.min_bpm}–${hz.max_bpm == null ? (maxHr ?? 'max') : hz.max_bpm} bpm` : '';
		})
	);
	let chartEl: HTMLDivElement;

	const zoneTotals = $derived(() => {
		const zones = [0, 0, 0, 0, 0];
		for (const a of activities) {
			zones[0] += a.hr_time_in_zone_1 ?? 0;
			zones[1] += a.hr_time_in_zone_2 ?? 0;
			zones[2] += a.hr_time_in_zone_3 ?? 0;
			zones[3] += a.hr_time_in_zone_4 ?? 0;
			zones[4] += a.hr_time_in_zone_5 ?? 0;
		}
		const total = zones.reduce((s, v) => s + v, 0);
		const pcts = zones.map(z => total > 0 ? z / total : 0);
		return {
			zones, total, pcts,
			easy: pcts[0] + pcts[1],
			moderate: pcts[2],
			hard: pcts[3] + pcts[4],
		};
	});

	const diag = $derived(() => {
		const { easy, moderate, hard, pcts } = zoneTotals();
		const pct = (v: number) => Math.round(v * 100);

		if (activities.length < 3) {
			return { text: 'Not enough activities to analyze yet.', color: C.textDim };
		}
		if (moderate > 0.40) {
			return {
				text: `${pct(moderate)}% of your time is in Z3 — the gray zone. This intensity is too hard to recover from quickly, but too easy to build top-end fitness. Replace some moderate runs with truly easy Z2 runs or hard Z4 intervals.`,
				color: C.red,
			};
		}
		if (moderate > 0.25) {
			return {
				text: `${pct(moderate)}% in Z3 is higher than ideal. Aim for < 20%. On easy days, slow down to stay in Z2. On hard days, push into Z4+. Avoid the middle ground.`,
				color: C.amber,
			};
		}
		if (hard < 0.05) {
			return {
				text: `Only ${pct(hard)}% in Z4–Z5. You're missing the high-intensity stimulus that drives VO2max and speed gains. Add one interval or tempo session per week.`,
				color: C.amber,
			};
		}
		if (easy > 0.70 && hard > 0.10) {
			return {
				text: `Good polarization: ${pct(easy)}% easy, ${pct(hard)}% hard, ${pct(moderate)}% moderate. Keep the easy days easy and the hard days hard.`,
				color: C.green,
			};
		}
		if (easy > 0.85) {
			return {
				text: `${pct(easy)}% easy running — great for base building, but consider adding one hard session per week to maintain speed.`,
				color: C.amber,
			};
		}
		return {
			text: `${pct(easy)}% easy, ${pct(moderate)}% moderate, ${pct(hard)}% hard. Aim for ~80/5/15 split.`,
			color: C.textSecondary,
		};
	});

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		const { pcts } = zoneTotals();

		_chart.setOption({
			grid: { top: 20, right: 10, bottom: 38, left: 35 },
			xAxis: {
				type: 'category', data: zoneLabels,
				axisLine: CHART_AXIS.axisLine,
				axisLabel: { color: C.textSecondary, fontSize: 10, lineHeight: 14, fontFamily: MONO },
			},
			yAxis: {
				type: 'value', max: 1,
				axisLine: { show: false },
				axisLabel: { color: C.textDim, fontSize: 10, fontFamily: MONO, formatter: (v: number) => `${Math.round(v * 100)}%` },
				splitLine: CHART_AXIS.splitLine,
			},
			series: [{
				type: 'bar',
				data: pcts.map((p, i) => ({ value: p, itemStyle: { color: ZONE_COLORS[i], borderRadius: [3, 3, 0, 0] } })),
				barWidth: '60%',
				label: {
					show: true,
					position: 'top',
					formatter: (params: any) => params.value > 0 ? `${Math.round(params.value * 100)}%` : '',
					color: C.textSecondary,
					fontSize: 10,
					fontFamily: MONO,
				},
			}],
			tooltip: { show: false },
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4 h-full">
	<Tip text={"HR zone distribution for the selected time window.\nBased on Seiler's polarized training model.\n\nIdeal: ~80% Z1–Z2 (easy), ~15% Z4–Z5 (hard), < 10% Z3.\nNot a Garmin metric — computed from your HR zone data."}>
		<h2 class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartPieSlice size={14} weight="bold" /> Training Polarization</h2>
	</Tip>
	<div bind:this={chartEl} class="h-[140px] w-full"></div>
	{#if true}
		{@const d = diag()}
		<div class="mt-2 border-t border-card-border/50 pt-2">
			<p class="text-xs leading-relaxed" style="color: {d.color}">{d.text}</p>
		</div>
	{/if}
</div>
