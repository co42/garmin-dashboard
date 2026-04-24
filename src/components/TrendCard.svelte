<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { C, CHART_TOOLTIP, CHART_AXIS, MONO } from '$lib/colors.js';
	import { formatRaw, formatRawDelta } from '$lib/profile.js';
	import Tip from './Tip.svelte';

	interface Series {
		name: string;
		color: string;
		values: (number | null)[];
	}

	interface Props {
		title: string;
		tip: string;
		/** Raw-value key used to format numbers in axis labels & tooltip */
		rawKey: string;
		labels: string[];
		series: Series[];
		/** Y-axis *base* tick interval (1 vo2max · 5 hill · 100 endurance …).
		 * The actual step scales up by {1, 2, 5, 10, 20, 50 …} × base when the range
		 * would otherwise produce too many labels. */
		interval: number;
	}

	let { title, tip, rawKey, labels, series, interval }: Props = $props();

	let chartEl = $state<HTMLDivElement>();
	let chart: any;
	let ro: ResizeObserver | undefined;
	let ready = $state(false);

	onDestroy(() => {
		ro?.disconnect();
		chart?.dispose();
	});

	/** Pick a "nice" step ≥ minStep so the axis shows at most `targetTicks` labels. */
	function niceStep(range: number, minStep: number, targetTicks = 6): number {
		const mults = [1, 2, 5];
		let mag = 1;
		while (mag < 1e9) {
			for (const m of mults) {
				const step = minStep * m * mag;
				if (range / step <= targetTicks) return step;
			}
			mag *= 10;
		}
		return minStep;
	}

	function computeYScale(values: number[], minStep: number): { min: number; max: number; step: number } {
		if (values.length === 0) return { min: 0, max: minStep, step: minStep };
		const mn = Math.min(...values);
		const mx = Math.max(...values);
		const range = Math.max(mx - mn, minStep);
		const step = niceStep(range, minStep);
		const eps = 1e-9;
		let lo = Math.floor(mn / step) * step;
		let hi = Math.ceil(mx / step) * step;
		if (mn - lo < eps) lo -= step;
		if (hi - mx < eps) hi += step;
		return { min: lo, max: hi, step };
	}

	function render() {
		if (!chart) return;
		const flat = series.flatMap(s => s.values).filter((v): v is number => v != null);
		const scale = computeYScale(flat, interval);

		chart.setOption({
			grid: { top: 8, right: 8, bottom: 24, left: 40, containLabel: false },
			tooltip: {
				...CHART_TOOLTIP,
				trigger: 'axis',
				textStyle: { color: C.text, fontSize: 11, fontFamily: MONO },
				formatter: (params: any) => {
					if (!Array.isArray(params) || params.length === 0) return '';
					const idx = params[0].dataIndex;
					let html = `<b>${params[0].axisValueLabel}</b><br/><table style="border-spacing:8px 1px">`;
					for (const p of params) {
						if (p.value == null) continue;
						const s = series[p.seriesIndex];
						if (!s) continue;
						const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:2px"></span>`;
						const rawStr = formatRaw(rawKey, p.value);
						let delta = '';
						if (idx > 0) {
							const prev = series[p.seriesIndex].values[idx - 1];
							if (prev != null) {
								const d = p.value - prev;
								const color = d > 0 ? C.green : d < 0 ? C.red : C.textDim;
								delta = `<span style="color:${color}">${formatRawDelta(rawKey, d)}</span>`;
							}
						}
						html += `<tr><td>${dot}${s.name}&nbsp;</td><td style="text-align:right"><b>${rawStr}</b>&nbsp;</td><td style="text-align:right">${delta}</td></tr>`;
					}
					html += '</table>';
					return html;
				},
			},
			legend: { show: false },
			xAxis: {
				type: 'category', data: labels, boundaryGap: false,
				...CHART_AXIS,
				axisLabel: { ...CHART_AXIS.axisLabel, showMinLabel: true, showMaxLabel: true, hideOverlap: true },
			},
			yAxis: {
				type: 'value',
				min: scale.min, max: scale.max,
				interval: scale.step,
				axisLine: { show: false },
				axisLabel: {
					...CHART_AXIS.axisLabel,
					formatter: (v: number) => formatRaw(rawKey, v),
				},
				splitLine: CHART_AXIS.splitLine,
			},
			series: series.map(s => ({
				type: 'line' as const,
				name: s.name,
				data: s.values,
				smooth: true,
				symbol: 'none',
				lineStyle: { width: 2, color: s.color },
				itemStyle: { color: s.color },
				connectNulls: false,
			})),
		}, true);
	}

	onMount(async () => {
		const echarts = await import('echarts');
		chart = echarts.init(chartEl!, undefined, { renderer: 'svg' });
		ro = new ResizeObserver(() => chart.resize());
		ro.observe(chartEl!);
		ready = true;
	});

	$effect(() => {
		if (!ready) return;
		labels; series;
		render();
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<div class="flex items-center justify-between gap-y-1 mb-2">
		<Tip text={tip}>
			<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">{title}</h2>
		</Tip>
		{#if series.length > 1}
			<span class="flex items-center gap-3 text-[10px]">
				{#each series as s}
					<span class="flex items-center gap-1 text-text-secondary">
						<span class="inline-block w-2.5 h-0.5 rounded-full" style="background: {s.color}"></span>
						{s.name}
					</span>
				{/each}
			</span>
		{/if}
	</div>
	<div bind:this={chartEl} class="flex-1 min-h-[140px] w-full"></div>
</div>
