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
	<div class="flex-1 mt-3">
	<table class="w-full h-full" style="border-collapse: separate; border-spacing: 0 8px;">
		<tbody>
		{#each rows as row}
			{@const total = row.zones ? row.zones[row.zones.length - 1].max - row.zones[0].min : 0}
			<tr>
				<td class="pr-3 whitespace-nowrap align-middle">
					<span class="text-xs text-text-secondary">{row.name}</span>
				</td>
				<td class="w-full align-middle">
					<Tip text={row.tipText} html={row.tipHtml || undefined}>
						<div class="relative h-5">
							<div class="absolute inset-0 rounded bg-card-border overflow-hidden">
								{#if row.zones}
									<div class="flex h-full gap-px">
										{#each row.zones as z}
											{@const isActive = row.activeZone === z}
											<div style="flex: {(z.max - z.min) / total}; background: {z.color}; opacity: {isActive ? 0.9 : 0.18};"></div>
										{/each}
									</div>
								{:else}
									<div class="h-full" style="background: {row.color}; opacity: 0.9; width: {row.posPct}%"></div>
								{/if}
							</div>
							<!-- White tick at current value (matches LoadBalance bounds markers) -->
							<div
								class="absolute z-10 pointer-events-none"
								style="left: {row.posPct}%; top: -3px; bottom: -3px; width: 2px; transform: translateX(-50%); background: {C.text}; box-shadow: 0 0 0 1px {C.card}; border-radius: 1px;"
							></div>
						</div>
					</Tip>
				</td>
				<td class="pl-3 whitespace-nowrap align-middle text-left">
					<div class="leading-tight">
						{#if row.activeZone}
							<div class="text-xs font-semibold" style="color: {row.activeZone.color}">{row.activeZone.name}</div>
						{/if}
						<div class="num text-[10px] font-medium" style="color: {row.delta > 0 ? C.green : row.delta < 0 ? C.red : C.textDim}">
							{formatRawDelta(row.key, row.delta)}
						</div>
					</div>
				</td>
			</tr>
		{/each}
		</tbody>
	</table>
	</div>
</div>
