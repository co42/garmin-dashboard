<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Activity, HrZone } from '$lib/types.js';
	import Tip from './Tip.svelte';

	interface Props {
		activities: Activity[];
		hrZones: HrZone[];
	}

	let { activities, hrZones }: Props = $props();

	const zoneLabels = $derived(
		[1, 2, 3, 4, 5].map(z => {
			const hz = hrZones.find(h => h.zone === z);
			return hz ? `Z${z}\n${hz.min_bpm}–${hz.max_bpm === 999 ? '∞' : hz.max_bpm}` : `Z${z}`;
		})
	);

	const zoneBpmTip = $derived(
		[1, 2, 3, 4, 5].map(z => {
			const hz = hrZones.find(h => h.zone === z);
			return hz ? `${hz.min_bpm}–${hz.max_bpm === 999 ? 'max' : hz.max_bpm} bpm` : '';
		})
	);
	let chartEl: HTMLDivElement;

	const zoneTotals = $derived(() => {
		const recent = activities.slice(0, 20);
		const zones = [0, 0, 0, 0, 0];
		for (const a of recent) {
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
			easy: pcts[0] + pcts[1],       // Z1 + Z2
			moderate: pcts[2],              // Z3
			hard: pcts[3] + pcts[4],        // Z4 + Z5
		};
	});

	// Diagnostic based on Seiler's polarized training model:
	// - Elite endurance athletes spend ~80% below VT1 (Z1-Z2) and ~20% above VT2 (Z4-Z5)
	// - Z3 ("threshold" / "gray zone") should be minimal — it's too hard to recover from
	//   quickly but too easy to produce the neuromuscular adaptations of Z4-Z5
	// - This is not a Garmin metric — it's computed from your HR zone distribution
	//
	// Thresholds:
	// - Z3 > 40%: clearly too much moderate work, most training is in the gray zone
	// - Z3 > 25%: moderate zone is creeping up, should be reduced
	// - Z4+Z5 < 5%: no intensity at all (with enough data to judge)
	// - Z1+Z2 > 75% AND Z4+Z5 > 10%: good polarization
	// - Z1+Z2 > 85%: very easy, probably needs one intensity session per week
	const diag = $derived(() => {
		const { easy, moderate, hard, pcts } = zoneTotals();
		const pct = (v: number) => Math.round(v * 100);

		// Not enough data
		if (activities.length < 3) {
			return { text: 'Not enough activities to analyze yet.', color: '#555568' };
		}

		// Z3 dominance — the most actionable issue
		if (moderate > 0.40) {
			return {
				text: `${pct(moderate)}% of your time is in Z3 — the gray zone. This intensity is too hard to recover from quickly, but too easy to build top-end fitness. Replace some moderate runs with truly easy Z2 runs or hard Z4 intervals.`,
				color: '#ef4444',
			};
		}
		if (moderate > 0.25) {
			return {
				text: `${pct(moderate)}% in Z3 is higher than ideal. Aim for < 20%. On easy days, slow down to stay in Z2. On hard days, push into Z4+. Avoid the middle ground.`,
				color: '#f59e0b',
			};
		}

		// No intensity
		if (hard < 0.05) {
			return {
				text: `Only ${pct(hard)}% in Z4–Z5. You're missing the high-intensity stimulus that drives VO2max and speed gains. Add one interval or tempo session per week.`,
				color: '#f59e0b',
			};
		}

		// Good polarization
		if (easy > 0.70 && hard > 0.10) {
			return {
				text: `Good polarization: ${pct(easy)}% easy, ${pct(hard)}% hard, ${pct(moderate)}% moderate. Keep the easy days easy and the hard days hard.`,
				color: '#22c55e',
			};
		}

		// Very easy, no intensity
		if (easy > 0.85) {
			return {
				text: `${pct(easy)}% easy running — great for base building, but consider adding one hard session per week to maintain speed.`,
				color: '#f59e0b',
			};
		}

		return {
			text: `${pct(easy)}% easy, ${pct(moderate)}% moderate, ${pct(hard)}% hard. Aim for ~80/5/15 split.`,
			color: '#8888a0',
		};
	});

	let _chart: any; let _ro: ResizeObserver;
	onDestroy(() => { _ro?.disconnect(); _chart?.dispose(); });

	onMount(async () => {
		const echarts = await import('echarts');
		_chart = echarts.init(chartEl, undefined, { renderer: 'svg' });
		const { pcts } = zoneTotals();
		const zoneColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];

		_chart.setOption({
			grid: { top: 10, right: 10, bottom: 38, left: 35 },
			xAxis: {
				type: 'category', data: zoneLabels,
				axisLine: { lineStyle: { color: '#2a2a3a' } },
				axisLabel: { color: '#8888a0', fontSize: 10, lineHeight: 14, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace' },
			},
			yAxis: {
				type: 'value', max: 1,
				axisLine: { show: false },
				axisLabel: { color: '#555568', fontSize: 10, formatter: (v: number) => `${Math.round(v * 100)}%` },
				splitLine: { lineStyle: { color: '#1e1e2a' } },
			},
			series: [{
				type: 'bar',
				data: pcts.map((p, i) => ({ value: p, itemStyle: { color: zoneColors[i], borderRadius: [3, 3, 0, 0] } })),
				barWidth: '60%',
			}],
			tooltip: {
				trigger: 'axis', confine: true, backgroundColor: '#1e1e2a', borderColor: '#2a2a3a',
				textStyle: { color: '#e8e8ed', fontSize: 12, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace' },
				formatter: (params: any) => {
					const i = params[0].dataIndex;
					const bpm = zoneBpmTip[i];
					return `Z${i + 1}${bpm ? ' (' + bpm + ')' : ''}: ${(params[0].value * 100).toFixed(1)}%`;
				},
			},
		});

		_ro = new ResizeObserver(() => _chart.resize());
		_ro.observe(chartEl);
	});
</script>

<div class="rounded-lg bg-card p-4 h-full">
	<Tip text={"HR zone distribution from your last 20 runs.\nBased on Seiler's polarized training model.\n\nIdeal: ~80% Z1–Z2 (easy), ~15% Z4–Z5 (hard), < 10% Z3.\nNot a Garmin metric — computed from your HR zone data."}>
		<h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">Training Polarization</h2>
	</Tip>
	<div bind:this={chartEl} class="h-[140px] w-full"></div>
	{#if true}
		{@const d = diag()}
		<div class="mt-2 border-t border-card-border/50 pt-2">
			<p class="text-xs leading-relaxed" style="color: {d.color}">{d.text}</p>
		</div>
	{/if}
</div>
