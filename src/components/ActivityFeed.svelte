<script lang="ts">
	import type { Activity } from '$lib/types.js';
	import { formatDistance } from '$lib/format.js';
	import Tip from './Tip.svelte';

	interface Props {
		activities: Activity[];
	}

	let { activities }: Props = $props();

	function fmtDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function badgeColor(label: string | null): string {
		if (!label) return '#555568';
		const l = label.toUpperCase();
		if (l.includes('TEMPO') || l.includes('THRESHOLD')) return '#f59e0b';
		if (l.includes('INTERVAL') || l.includes('SPEED') || l.includes('VO2MAX')) return '#ef4444';
		if (l.includes('RECOVERY') || l.includes('BASE')) return '#14b8a6';
		if (l.includes('LONG')) return '#3b82f6';
		return '#22c55e';
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

	const ZONE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];

	// Color load relative to the median load across all activities
	// Below median = easy (green), around median = moderate (amber), well above = hard (red)
	const medianLoad = $derived(() => {
		const loads = activities.map(a => a.activity_training_load).filter((l): l is number => l != null).sort((a, b) => a - b);
		if (loads.length === 0) return 100;
		return loads[Math.floor(loads.length / 2)];
	});

	function loadColor(load: number | null): string {
		if (load == null) return '#555568';
		const med = medianLoad();
		const ratio = load / med;
		if (ratio < 0.7) return '#3b82f6';   // easy session (blue, like Z1-Z2)
		if (ratio < 1.0) return '#22c55e';    // moderate (green, normal)
		if (ratio < 1.4) return '#f59e0b';    // hard (amber, above your usual)
		return '#ef4444';                      // very hard (red, significantly above usual)
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
	<h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">Recent Activities</h2>

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
							<span class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style="background: {teColor}20; color: {teColor};">
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
							<div class="flex items-end gap-px h-5 w-20">
								{#each zones.pcts as pct, i}
									<div
										class="flex-1 rounded-t-sm"
										style="height: {maxPct > 0 ? (pct / maxPct) * 100 : 0}%; background: {ZONE_COLORS[i]};"
										title="Z{i+1}: {Math.round(pct)}%"
									></div>
								{/each}
							</div>
						{:else}
							<span class="text-text-dim">-</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
