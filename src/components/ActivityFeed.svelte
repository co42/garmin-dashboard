<script lang="ts">
	import type { Activity, HrZone } from '$lib/types.js';
	import { formatDistance } from '$lib/format.js';
	import { C, ZONE_COLORS } from '$lib/colors.js';
	import Tip from './Tip.svelte';
	import ListBullets from 'phosphor-svelte/lib/ListBullets';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import PersonSimpleBike from 'phosphor-svelte/lib/PersonSimpleBike';
	import PersonSimpleSwim from 'phosphor-svelte/lib/PersonSimpleSwim';
	import PersonSimpleHike from 'phosphor-svelte/lib/PersonSimpleHike';
	import Barbell from 'phosphor-svelte/lib/Barbell';

	interface Props {
		activities: Activity[];
		hrZones: HrZone[];
	}

	let { activities, hrZones }: Props = $props();

	function fmtDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function badgeColor(label: string | null): string {
		if (!label) return C.textDim;
		const l = label.toUpperCase();
		if (l.includes('TEMPO') || l.includes('THRESHOLD')) return C.amber;
		if (l.includes('INTERVAL') || l.includes('SPEED') || l.includes('VO2MAX')) return C.red;
		if (l.includes('RECOVERY') || l.includes('BASE')) return C.teal;
		if (l.includes('LONG')) return C.blue;
		return C.green;
	}

	function formatTELabel(label: string | null): string {
		if (!label) return '-';
		return label.charAt(0) + label.slice(1).toLowerCase().replace(/_/g, ' ');
	}

	function speedToPace(speed: number | null): string {
		if (!speed || speed <= 0) return '-';
		const paceSeconds = 1000 / speed;
		const m = Math.floor(paceSeconds / 60);
		const s = Math.floor(paceSeconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	// ZONE_COLORS imported from $lib/colors.js

	// Color load relative to the median load across all activities
	// Below median = easy (green), around median = moderate (amber), well above = hard (red)
	const medianLoad = $derived(() => {
		const loads = activities.map(a => a.activity_training_load).filter((l): l is number => l != null).sort((a, b) => a - b);
		if (loads.length === 0) return 100;
		return loads[Math.floor(loads.length / 2)];
	});

	function loadColor(load: number | null): string {
		if (load == null) return C.textDim;
		const med = medianLoad();
		const ratio = load / med;
		if (ratio < 0.7) return C.blue;       // easy session
		if (ratio < 1.0) return C.green;      // moderate
		if (ratio < 1.4) return C.amber;      // hard
		return C.red;                          // very hard
	}

	function zoneData(a: Activity): { pcts: number[]; total: number } {
		const zones = [
			a.hr_time_in_zone_1 ?? 0,
			a.hr_time_in_zone_2 ?? 0,
			a.hr_time_in_zone_3 ?? 0,
			a.hr_time_in_zone_4 ?? 0,
			a.hr_time_in_zone_5 ?? 0,
		];
		const total = zones.reduce((s, v) => s + v, 0);
		return { pcts: zones.map(z => total > 0 ? z / total * 100 : 0), total };
	}

	const TE_TIPS: Record<string, string> = {
		'BASE': 'Easy aerobic effort. Builds your foundation without significant stress.',
		'TEMPO': 'Moderate-hard sustained effort. Improves lactate threshold and speed endurance.',
		'THRESHOLD': 'At or near lactate threshold. Pushes the pace you can sustain for long efforts.',
		'INTERVAL': 'High-intensity repeats. Builds VO2max and neuromuscular power.',
		'SPEED': 'Short, very fast efforts. Develops raw speed and running economy.',
		'VO2MAX': 'Near-maximal effort. The most effective stimulus for VO2max improvement.',
		'RECOVERY': 'Very easy. Active recovery — promotes blood flow without adding training stress.',
		'LONG_RUN': 'Extended easy effort. Builds endurance, fat oxidation, and mental toughness.',
	};

	function teTip(label: string | null): string {
		if (!label) return 'Training effect type from Garmin — what stimulus this session provided.';
		const key = label.toUpperCase();
		for (const [k, v] of Object.entries(TE_TIPS)) {
			if (key.includes(k)) return v;
		}
		return 'Training effect type from Garmin.';
	}
</script>

<div class="rounded-lg bg-card p-4">
	<h2 class="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary"><ListBullets size={14} weight="bold" /> Recent Activities</h2>

	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-card-border text-left text-xs text-text-dim">
				<th class="pb-2 pr-3 font-medium">Date</th>
				<th class="pb-2 pr-3 font-medium">Type</th>
				<th class="pb-2 pr-3 font-medium">Name</th>
				<th class="pb-2 pr-3 font-medium text-right">Dist</th>
				<th class="pb-2 pr-3 font-medium text-right">Pace</th>
				<th class="pb-2 pr-3 font-medium text-right">
					<Tip text={"Grade Adjusted Pace — your pace normalized for elevation.\nFlat equivalent of your effort on hills.\nFaster than actual pace on uphills, slower on downhills."}>GAP</Tip>
				</th>
				<th class="pb-2 pr-3 font-medium text-right">
					<Tip text="EPOC-based training load. Higher = more stress on the body.\nThese sum up to form your acute (7d) and chronic (28d) load.">Load</Tip>
				</th>
				<th class="pb-2 font-medium">
					<Tip text={"HR zone distribution for this activity.\nZ1 blue · Z2 green · Z3 amber · Z4 red · Z5 purple"}>Zones</Tip>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each activities as activity}
				{@const teColor = badgeColor(activity.training_effect_label)}
				{@const zones = zoneData(activity)}
				<tr class="border-b border-card-border/50 hover:bg-card-border/20">
					<td class="py-2 pr-3 text-text-secondary whitespace-nowrap text-xs num">{fmtDate(activity.start_time)}</td>
					<td class="py-2 pr-3">
						<Tip text={teTip(activity.training_effect_label)}>
							<span class="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style="background: {teColor}20; color: {teColor};">
								{#if activity.activity_type === 'trail_running'}
									<Mountains size={12} weight="bold" />
								{:else if activity.activity_type === 'cycling' || activity.activity_type === 'indoor_cycling'}
									<PersonSimpleBike size={12} weight="bold" />
								{:else if activity.activity_type === 'swimming' || activity.activity_type === 'open_water_swimming'}
									<PersonSimpleSwim size={12} weight="bold" />
								{:else if activity.activity_type === 'hiking'}
									<PersonSimpleHike size={12} weight="bold" />
								{:else if activity.activity_type === 'strength_training' || activity.activity_type === 'cardio_training'}
									<Barbell size={12} weight="bold" />
								{:else}
									<PersonSimpleRun size={12} weight="bold" />
								{/if}
								{formatTELabel(activity.training_effect_label)}
							</span>
						</Tip>
					</td>
					<td class="py-2 pr-3 font-medium text-text max-w-[200px] truncate">{activity.name}</td>
					<td class="py-2 pr-3 text-right text-text num">{formatDistance(activity.distance_meters)}</td>
					<td class="py-2 pr-3 text-right text-text-secondary num whitespace-nowrap">{activity.pace_min_km?.replace(' /km', '') ?? '-'}</td>
					<td class="py-2 pr-3 text-right text-text-secondary num whitespace-nowrap">{speedToPace(activity.avg_grade_adjusted_speed)}</td>
					<td class="py-2 pr-3 text-right num font-bold" style="color: {loadColor(activity.activity_training_load)}">{activity.activity_training_load != null ? Math.round(activity.activity_training_load) : '-'}</td>
					<td class="py-2">
						{#if zones.total > 0}
							{@const maxPct = Math.max(...zones.pcts)}
							{@const tipText = zones.pcts.map((p, i) => {
								const hz = hrZones.find(h => h.zone === i + 1);
								const bpm = hz ? `${String(hz.min_bpm).padStart(3)}–${hz.max_bpm === 999 ? 'max' : String(hz.max_bpm).padStart(3)}` : '';
								return `Z${i + 1} ${bpm}: ${String(Math.round(p)).padStart(2)}%`;
							}).join('\n')}
							<Tip text={tipText} mono>
								<div class="flex items-end gap-px h-5 w-20">
									{#each zones.pcts as pct, i}
										<div
											class="flex-1 rounded-t-sm"
											style="height: {maxPct > 0 ? Math.max((pct / maxPct) * 100, pct > 0 ? 12 : 0) : 0}%; background: {ZONE_COLORS[i]}; {pct === 0 ? `background: ${ZONE_COLORS[i]}30; min-height: 2px;` : ''}"
										></div>
									{/each}
								</div>
							</Tip>
						{:else}
							<span class="text-text-dim">-</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
