<script lang="ts">
	import type { HillScore, DailyTrainingStatus, EnduranceScore, UserSettings } from '$lib/types.js';
	import { AXES, RADAR_AXIS_ORDER, AXIS_COLORS, normalize, formatRawDelta, computeProductivity, computeAge, axisZones, hillSubColor, type Zone } from '$lib/profile.js';
	import { weekMonday } from '$lib/dates.js';
	import { C } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import ChartPolar from 'phosphor-svelte/lib/ChartPolar';

	interface Props {
		hillScore: HillScore;
		currentStatus: DailyTrainingStatus;
		enduranceScore: EnduranceScore;
		vo2max: number;
		statusHistory: DailyTrainingStatus[];
		fullStatusHistory: DailyTrainingStatus[];
		hillScoreHistory: HillScore[];
		enduranceScoreHistory: EnduranceScore[];
		userSettings: UserSettings | null;
	}

	let { hillScore, currentStatus: _currentStatus, enduranceScore, vo2max, fullStatusHistory, hillScoreHistory, enduranceScoreHistory, userSettings }: Props = $props();

	const ctx = $derived.by(() => {
		const sex: 'male' | 'female' = userSettings?.gender === 'female' ? 'female' : 'male';
		return { age: computeAge(userSettings?.birth_date), sex };
	});

	function rawValue(key: string): number {
		switch (key) {
			case 'vo2max': return vo2max;
			case 'endurance': return enduranceScore.score;
			case 'hill': return hillScore.overall_score;
			case 'productivity': return Math.max(0, computeProductivity(fullStatusHistory));
			default: return 0;
		}
	}

	type HillSubScore = {
		label: string;
		key: 'hillEnd' | 'hillStr';
		raw: number;
		color: string;
		delta: number;
	};

	type AxisRow = {
		key: string;
		name: string;
		raw: number;
		rawStr: string;
		delta: number;
		color: string;
		tipText: string;
		tipHtml: string;
		zones: Zone[] | null;
		/** User's position along the bar, 0–100 */
		posPct: number;
		/** Zone that contains the user's value, if any */
		activeZone: Zone | null;
		/** For the Hill row only: End & Str values shown inline next to the overall score. */
		hillSubs: HillSubScore[] | null;
	};

	function fmtRaw(key: string, raw: number): string {
		if (key === 'vo2max') return raw.toFixed(1);
		if (key === 'endurance') return Math.round(raw).toLocaleString();
		if (key === 'productivity') return Math.round(raw) + '%';
		return String(Math.round(raw));
	}

	function fmtRange(key: string, min: number, max: number): string {
		// Integer-based axes (endurance, hill, productivity) use inclusive bounds Garmin-style ("5800 – 6499")
		if (key === 'endurance' || key === 'hill' || key === 'hillStr' || key === 'hillEnd' || key === 'productivity') {
			return `${fmtRaw(key, min)} – ${fmtRaw(key, max - 1)}`;
		}
		return `${fmtRaw(key, min)} – ${fmtRaw(key, max)}`;
	}

	function zoneTableRows(zones: Zone[], userRaw: number, rawStr: string, key: string): string {
		return zones.map(z => {
			const inZone = userRaw >= z.min && userRaw < z.max;
			const range = fmtRange(key, z.min, z.max);
			const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${z.color};margin-right:6px;vertical-align:middle"></span>`;
			const nameStyle = inZone ? `color:${z.color};font-weight:700` : '';
			const marker = inZone
				? `<td style="color:${z.color};padding-left:8px;font-weight:700">← ${rawStr}</td>`
				: '<td></td>';
			return `<tr><td style="${nameStyle}">${swatch}${z.name}</td><td style="text-align:right;padding-left:12px;color:${C.textSecondary}" class="num">${range}</td>${marker}</tr>`;
		}).join('');
	}

	function buildZoneTipHtml(title: string, zones: Zone[], userRaw: number, rawStr: string, key: string, extras = ''): string {
		const body = zoneTableRows(zones, userRaw, rawStr, key);
		return `<div style="font-weight:600;margin-bottom:6px;color:${C.text}">${title}</div>`
			+ `<table style="border-spacing:0 2px;font-size:11px">${body}</table>`
			+ extras;
	}

	function buildHillExtras(hillSubs: HillSubScore[]): string {
		const rows = hillSubs.map(sub => {
			return `<tr><td style="padding-right:8px;color:${C.textSecondary}">${sub.label}</td><td style="text-align:right;font-weight:700;color:${sub.color}" class="num">${sub.raw}</td></tr>`;
		}).join('');
		return `<div style="margin-top:8px;padding-top:6px;border-top:1px solid ${C.cardBorder};font-size:11px"><table style="border-spacing:0 1px">${rows}</table></div>`;
	}

	// Week-over-week raw-value deltas, bucketed last-of-week (Monday → next Monday)
	const weekDeltas = $derived.by(() => {
		const statusByWeek = new Map<string, DailyTrainingStatus>();
		for (const s of [...fullStatusHistory].filter(s => s.date).sort((a, b) => a.date.localeCompare(b.date))) {
			statusByWeek.set(weekMonday(s.date), s);
		}
		const hillByWeek = new Map<string, HillScore>();
		for (const h of [...hillScoreHistory].filter(h => h.date).sort((a, b) => a.date.localeCompare(b.date))) {
			hillByWeek.set(weekMonday(h.date), h);
		}
		const endurByWeek = new Map<string, EnduranceScore>();
		for (const e of [...enduranceScoreHistory].filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date))) {
			endurByWeek.set(weekMonday(e.date), e);
		}

		const weeks = [...statusByWeek.keys()].sort();
		const zero = { vo2max: 0, endurance: 0, productivity: 0, hill: 0, hillEnd: 0, hillStr: 0 };
		if (weeks.length < 2) return zero;
		const cur = weeks[weeks.length - 1];
		const prev = weeks[weeks.length - 2];
		const curS = statusByWeek.get(cur)!;
		const prevS = statusByWeek.get(prev)!;
		const curH = hillByWeek.get(cur);
		const prevH = hillByWeek.get(prev);
		const curE = endurByWeek.get(cur);
		const prevE = endurByWeek.get(prev);

		const curProd = computeProductivity(fullStatusHistory, curS.date);
		const prevProd = computeProductivity(fullStatusHistory, prevS.date);

		return {
			vo2max: (curS.vo2max ?? 0) - (prevS.vo2max ?? 0),
			endurance: curE && prevE ? curE.score - prevE.score : 0,
			productivity: curProd >= 0 && prevProd >= 0 ? curProd - prevProd : 0,
			hill: curH && prevH ? curH.overall_score - prevH.overall_score : 0,
			hillEnd: curH && prevH ? curH.endurance_score - prevH.endurance_score : 0,
			hillStr: curH && prevH ? curH.strength_score - prevH.strength_score : 0,
		};
	});


	const rows = $derived.by<AxisRow[]>(() => {
		return RADAR_AXIS_ORDER.map(key => {
			const raw = rawValue(key);
			const rawStr = fmtRaw(key, raw);
			const delta = weekDeltas[key as keyof typeof weekDeltas] ?? 0;

			const zones = axisZones(key, ctx);
			let posPct: number;
			let activeZone: Zone | null = null;

			const hillSubs: HillSubScore[] | null = key === 'hill'
				? [
					{ label: 'End', key: 'hillEnd', raw: hillScore.endurance_score, color: hillSubColor(hillScore.endurance_score), delta: weekDeltas.hillEnd ?? 0 },
					{ label: 'Str', key: 'hillStr', raw: hillScore.strength_score, color: hillSubColor(hillScore.strength_score), delta: weekDeltas.hillStr ?? 0 },
				]
				: null;

			let tipHtml = '';
			const tipText = AXES[key].tip;

			if (zones) {
				const first = zones[0].min;
				const last = zones[zones.length - 1].max;
				posPct = Math.max(0, Math.min(100, ((raw - first) / (last - first)) * 100));
				activeZone = zones.find(z => raw >= z.min && raw < z.max)
					?? (raw >= last ? zones[zones.length - 1] : zones[0]);
				const titles: Record<string, string> = {
					vo2max: `VO2max — Cooper scale · ${ctx.age}yo ${ctx.sex}`,
					endurance: `Endurance — Garmin zones · ${ctx.age}yo ${ctx.sex}`,
					hill: 'Hill score — Garmin zones',
					productivity: 'Productivity — 30-day weighted training quality',
				};
				const extras = hillSubs ? buildHillExtras(hillSubs) : '';
				tipHtml = buildZoneTipHtml(titles[key] ?? AXES[key].name, zones, raw, rawStr, key, extras);
			} else {
				posPct = normalize(key, raw, ctx);
			}

			return {
				key,
				name: AXES[key].name,
				raw,
				rawStr,
				delta,
				color: AXIS_COLORS[key],
				tipText,
				tipHtml,
				zones,
				posPct,
				activeZone,
				hillSubs,
			};
		});
	});
</script>

<div class="rounded-lg bg-card p-4 h-full flex flex-col">
	<h2 class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ChartPolar size={14} weight="bold" /> Profile</h2>
	<div class="flex-1 flex flex-col justify-around gap-3 mt-3">
		{#each rows as row}
			{@const total = row.zones ? row.zones[row.zones.length - 1].max - row.zones[0].min : 0}
			<Tip text={row.tipText} html={row.tipHtml || undefined}>
				<div>
					<div class="flex items-baseline justify-between text-xs mb-1.5">
						<span class="flex items-center gap-1.5 min-w-0">
							<span class="text-text-secondary">{row.name}</span>
							{#if row.activeZone}
								<span class="font-semibold" style="color: {row.activeZone.color}">{row.activeZone.name}</span>
							{/if}
						</span>
						<span class="num text-text whitespace-nowrap inline-flex items-baseline gap-1.5">
							{#if row.hillSubs}
								{#each row.hillSubs as sub}
									<span class="inline-flex items-baseline gap-1">
										<span class="text-text-dim">{sub.label}</span>
										<span class="font-semibold" style="color: {sub.color}">{sub.raw}</span>
										<span style="color: {sub.delta > 0 ? C.green : sub.delta < 0 ? C.red : C.textDim}">{formatRawDelta(sub.key, sub.delta)}</span>
									</span>
									<span class="text-text-dim">·</span>
								{/each}
							{/if}
							<span class="inline-flex items-baseline gap-1">
								<span>{row.rawStr}</span>
								<span style="color: {row.delta > 0 ? C.green : row.delta < 0 ? C.red : C.textDim}">{formatRawDelta(row.key, row.delta)}</span>
							</span>
						</span>
					</div>
					<div class="relative h-2 rounded-full overflow-hidden">
						{#if row.zones}
							<div class="absolute inset-0 flex gap-px">
								{#each row.zones as z}
									<div style="width: {((z.max - z.min) / total) * 100}%; background: {z.color}"></div>
								{/each}
							</div>
						{:else}
							<div class="absolute inset-0 bg-hover"></div>
							<div class="absolute inset-y-0 left-0" style="width: {row.posPct}%; background: {row.color}"></div>
						{/if}
						<div class="absolute inset-y-0 bg-card/75" style="left: {row.posPct}%; right: 0"></div>
					</div>
				</div>
			</Tip>
		{/each}
	</div>
</div>
