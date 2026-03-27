<script lang="ts">
	import type { Activity, ActivitySplit, ActivityWeather, HrZone } from '$lib/types.js';
	import { formatDistance, formatTime } from '$lib/format.js';
	import { C, ZONE_COLORS } from '$lib/colors.js';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import PersonSimpleBike from 'phosphor-svelte/lib/PersonSimpleBike';
	import PersonSimpleSwim from 'phosphor-svelte/lib/PersonSimpleSwim';
	import PersonSimpleHike from 'phosphor-svelte/lib/PersonSimpleHike';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Flame from 'phosphor-svelte/lib/Flame';
	import Sun from 'phosphor-svelte/lib/Sun';
	import CloudSun from 'phosphor-svelte/lib/CloudSun';
	import Cloud from 'phosphor-svelte/lib/Cloud';
	import CloudRain from 'phosphor-svelte/lib/CloudRain';
	import CloudSnow from 'phosphor-svelte/lib/CloudSnow';
	import CloudFog from 'phosphor-svelte/lib/CloudFog';
	import CloudLightning from 'phosphor-svelte/lib/CloudLightning';
	import Moon from 'phosphor-svelte/lib/Moon';
	import Tip from './Tip.svelte';

	interface Props {
		activity: Activity;
		splits?: ActivitySplit[];
		weather?: ActivityWeather | null;
		hrZones: HrZone[];
		loadColor: string;
		context: 'feed' | 'calendar';
		expanded?: boolean;
		ontoggle?: () => void;
	}

	let { activity, splits = [], weather = null, hrZones, loadColor, context, expanded = false, ontoggle }: Props = $props();

	// Inline title editing
	let editingTitle = $state(false);
	let editTitle = $state('');
	let nameOverride = $state<string | null>(null);
	const displayName = $derived(nameOverride ?? activity.name);

	async function saveTitle() {
		editingTitle = false;
		if (editTitle === displayName) return;
		nameOverride = editTitle;
		fetch(`/api/activity/${activity.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: nameOverride }),
		});
	}

	function startEditTitle(e: MouseEvent) {
		e.stopPropagation();
		editTitle = displayName;
		editingTitle = true;
	}

	function fmtDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
	}

	function fmtTime(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
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

	function teShort(label: string | null): { code: string; name: string; desc: string } | null {
		if (!label) return null;
		const l = label.toUpperCase();
		if (l.includes('BASE')) return { code: 'AB', name: 'Aerobic Base', desc: 'Easy effort building your aerobic foundation — the engine behind everything.' };
		if (l.includes('RECOVERY')) return { code: 'RC', name: 'Recovery', desc: 'Very low intensity. Promotes blood flow and recovery without adding load.' };
		if (l.includes('TEMPO')) return { code: 'TP', name: 'Tempo', desc: 'Comfortably hard effort near lactate threshold. Builds speed endurance.' };
		if (l.includes('THRESHOLD')) return { code: 'TH', name: 'Threshold', desc: 'Sustained effort at or near lactate threshold. Raises your ceiling pace.' };
		if (l.includes('VO2MAX')) return { code: 'VO', name: 'VO2max', desc: 'Hard intervals targeting maximal oxygen uptake. Builds top-end aerobic power.' };
		if (l.includes('INTERVAL')) return { code: 'IT', name: 'Interval', desc: 'High-intensity repeats with recovery. Improves speed and anaerobic capacity.' };
		if (l.includes('LONG')) return { code: 'LR', name: 'Long Run', desc: 'Extended duration at easy-to-moderate pace. Builds endurance and fat metabolism.' };
		if (l.includes('SPEED')) return { code: 'SP', name: 'Speed', desc: 'Short, fast efforts developing neuromuscular power and running economy.' };
		return { code: 'TR', name: label.charAt(0) + label.slice(1).toLowerCase().replace(/_/g, ' '), desc: 'Training session.' };
	}

	function speedToPace(speed: number | null): string {
		if (!speed || speed <= 0) return '-';
		const paceSeconds = 1000 / speed;
		const m = Math.floor(paceSeconds / 60);
		const s = Math.floor(paceSeconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function isTrail(a: Activity): boolean {
		if (!a.elevation_gain || !a.distance_meters || a.distance_meters < 1000) return false;
		return a.elevation_gain / (a.distance_meters / 1000) > 15;
	}

	function zoneData(a: Activity): { pcts: number[]; total: number } {
		const times = [
			a.hr_time_in_zone_1 ?? 0, a.hr_time_in_zone_2 ?? 0,
			a.hr_time_in_zone_3 ?? 0, a.hr_time_in_zone_4 ?? 0, a.hr_time_in_zone_5 ?? 0,
		];
		const total = times.reduce((s, v) => s + v, 0);
		return { pcts: times.map(z => total > 0 ? z / total * 100 : 0), total };
	}

	function weatherType(desc: string): 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm' | 'moon' {
		const d = desc.toLowerCase();
		if (d.includes('thunder') || d.includes('storm')) return 'storm';
		if (d.includes('rain') || d.includes('shower') || d.includes('drizzle')) return 'rain';
		if (d.includes('snow') || d.includes('sleet')) return 'snow';
		if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return 'fog';
		if (d.includes('partly') || d.includes('mostly clear') || d.includes('mostly sunny')) return 'cloud-sun';
		if (d.includes('cloud') || d.includes('overcast')) return 'cloud';
		if (d.includes('clear') || d.includes('sun') || d.includes('fair')) return 'sun';
		return 'cloud';
	}

	const teColor = $derived(badgeColor(activity.training_effect_label));
	const te = $derived(teShort(activity.training_effect_label));
	const zones = $derived(zoneData(activity));
	const trail = $derived(isTrail(activity));
	const hasElevation = $derived(activity.elevation_gain != null && activity.elevation_gain > 0);

	// Mini pace sparkline from splits
	const paces = $derived(
		(splits && splits.length >= 2)
			? splits.map(s => s.pace_seconds ?? 0).filter(p => p > 0)
			: []
	);
	const paceMin = $derived(paces.length > 0 ? Math.min(...paces) : 0);
	const paceMax = $derived(paces.length > 0 ? Math.max(...paces) : 0);
	const paceRange = $derived(paceMax - paceMin || 1);

	function scrollToActivity() {
		const el = document.getElementById(`activity-${activity.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<div class="w-full text-left px-4 py-3">
	<!-- Row 1: Name + badge + weather + date -->
	<div class="flex items-center gap-2 mb-1.5">
		<span style="color: {teColor};">
			{#if activity.activity_type === 'trail_running'}
				<Mountains size={16} weight="bold" />
			{:else if activity.activity_type === 'cycling' || activity.activity_type === 'indoor_cycling'}
				<PersonSimpleBike size={16} weight="bold" />
			{:else if activity.activity_type === 'swimming' || activity.activity_type === 'open_water_swimming'}
				<PersonSimpleSwim size={16} weight="bold" />
			{:else if activity.activity_type === 'hiking'}
				<PersonSimpleHike size={16} weight="bold" />
			{:else if activity.activity_type === 'strength_training' || activity.activity_type === 'cardio_training'}
				<Barbell size={16} weight="bold" />
			{:else}
				<PersonSimpleRun size={16} weight="bold" />
			{/if}
		</span>
		{#if te}
			<Tip text={te.name + '\n' + te.desc}>
				<span class="shrink-0 num text-[10px] font-bold" style="color: {teColor};">{te.code}</span>
			</Tip>
		{/if}
		{#if editingTitle}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="flex-1 min-w-0 bg-transparent text-sm font-medium text-text border-b border-blue-500/50 outline-none py-0"
				bind:value={editTitle}
				onblur={saveTitle}
				onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { editingTitle = false; } }}
				onclick={(e: MouseEvent) => e.stopPropagation()}
				autofocus
			/>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="font-medium text-text text-sm truncate"
				ondblclick={startEditTitle}
			>{displayName}</span>
		{/if}
		<span class="ml-auto shrink-0 flex items-center gap-2 text-xs text-text-dim num">
			{fmtDate(activity.start_time)} {fmtTime(activity.start_time)}
			{#if activity.location_name}
				<span class="text-text-dim">· {activity.location_name}</span>
			{/if}
			{#if weather}
				{@const wt = weatherType(weather.weather_description)}
				<span class="text-text-dim">·</span>
				<Tip text={`${weather.weather_description}\n${Math.round(weather.temperature_celsius)}°C (feels ${Math.round(weather.feels_like_celsius)}°C)\nWind ${Math.round(weather.wind_speed_kmh)} km/h ${weather.wind_direction_compass}\nHumidity ${Math.round(weather.humidity_percent)}%`}>
					<span class="flex items-center gap-1 text-text-dim">
						{#if wt === 'sun'}<Sun size={14} weight="bold" />
						{:else if wt === 'cloud-sun'}<CloudSun size={14} weight="bold" />
						{:else if wt === 'cloud'}<Cloud size={14} weight="bold" />
						{:else if wt === 'rain'}<CloudRain size={14} weight="bold" />
						{:else if wt === 'snow'}<CloudSnow size={14} weight="bold" />
						{:else if wt === 'fog'}<CloudFog size={14} weight="bold" />
						{:else if wt === 'storm'}<CloudLightning size={14} weight="bold" />
						{:else}<Moon size={14} weight="bold" />
						{/if}
						<span class="num">{Math.round(weather.temperature_celsius)}°</span>
					</span>
				</Tip>
			{/if}
			{#if context === 'feed'}
				<button
					class="cursor-pointer p-1 -m-1 rounded hover:bg-card-border/30 transition-colors"
					onclick={ontoggle}
					aria-label={expanded ? 'Collapse' : 'Expand'}
				>
					<CaretDown size={12} weight="bold" class="transition-transform {expanded ? 'rotate-180' : ''}" />
				</button>
			{:else}
				<button
					class="cursor-pointer text-text-dim hover:text-text-secondary transition-colors"
					onclick={(e: MouseEvent) => { e.stopPropagation(); scrollToActivity(); }}
					title="Jump to activity"
				>
					<ArrowSquareOut size={14} weight="bold" />
				</button>
			{/if}
		</span>
	</div>

	<!-- Row 2: Metrics -->
	<div class="flex items-center gap-3 text-xs">
		<span class="num text-text font-semibold">{formatDistance(activity.distance_meters)}<span class="text-text-dim font-normal">km</span></span>
		<span class="num text-text-secondary">{Math.floor(activity.duration_seconds / 3600)}:{Math.floor((activity.duration_seconds % 3600) / 60).toString().padStart(2, '0')}:{Math.floor(activity.duration_seconds % 60).toString().padStart(2, '0')}</span>
		{#if activity.pace_min_km}
			<span class="num text-text-secondary">{activity.pace_min_km.replace(' /km', '')}<span class="text-text-dim">/km</span></span>
		{/if}
		{#if trail && activity.avg_grade_adjusted_speed}
			<Tip text="Grade Adjusted Pace\nPace normalized for elevation — what your effort would equal on flat ground.">
				<span class="num text-text-secondary">GAP {speedToPace(activity.avg_grade_adjusted_speed)}<span class="text-text-dim">/km</span></span>
			</Tip>
		{/if}
		{#if trail}
			<span class="num text-text-secondary">D+ {activity.elevation_gain}m</span>
		{/if}
		{#if activity.avg_hr}
			<span class="num text-text-secondary">&#9829; {activity.avg_hr}{#if activity.max_hr} <span class="inline-flex items-center text-text-dim"><CaretUp size={10} weight="fill" />{activity.max_hr}</span>{/if}</span>
		{/if}

		<!-- Right group: sparkline + load + zones -->
		<span class="ml-auto flex items-center gap-3 shrink-0">
			{#if paces.length >= 2}
				<div class="flex items-end gap-px h-3" title="Pace per km">
					{#each paces as p}
						{@const pct = 20 + ((p - paceMin) / paceRange) * 80}
						<div class="w-1 rounded-t-sm" style="height: {pct}%; background: {C.blue};"></div>
					{/each}
				</div>
			{/if}

			{#if activity.activity_training_load != null}
				<Tip text={'Training Load\n4-week cumulative training stress from this session.\nHigher = more demanding. Color is relative to your median load.'}>
					<span class="flex items-center gap-0.5 num font-bold" style="color: {loadColor}">
						<Flame size={12} weight="fill" />
						{Math.round(activity.activity_training_load)}
					</span>
				</Tip>
			{/if}
			<Tip text={'Aerobic Training Effect\n' + (activity.aerobic_training_effect_message?.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase() ?? '')}>
				<span class="num text-[11px] text-text-dim">{(activity.aerobic_training_effect ?? 0).toFixed(1)}</span>
			</Tip>
			<Tip text={'Anaerobic Training Effect\n' + (activity.anaerobic_training_effect_message?.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase() ?? '')}>
				<span class="num text-[11px] text-text-dim">{(activity.anaerobic_training_effect ?? 0).toFixed(1)}</span>
			</Tip>

			{#if zones.total > 0}
				{@const maxPct = Math.max(...zones.pcts)}
				<Tip text={zones.pcts.map((p, i) => `Z${i + 1}  ${Math.round(p)}%`).join('\n')} mono>
					<div class="flex items-end gap-px h-4 w-16">
						{#each zones.pcts as pct, i}
							<div
								class="flex-1 rounded-t-sm"
								style="height: {maxPct > 0 ? Math.max((pct / maxPct) * 100, pct > 0 ? 12 : 0) : 0}%; background: {ZONE_COLORS[i]}; {pct === 0 ? `background: ${ZONE_COLORS[i]}30; min-height: 2px;` : ''}"
							></div>
						{/each}
					</div>
				</Tip>
			{/if}
		</span>
	</div>
</div>
