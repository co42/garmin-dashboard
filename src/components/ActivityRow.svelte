<script lang="ts">
	import type { Activity, ActivitySplit, ActivityWeather, HrZone } from '$lib/types.js';
	import { formatDistance, formatTime } from '$lib/format.js';
	import { C, ZONE_COLORS, hrZoneColor, arrMin, arrMax } from '$lib/colors.js';
	import PersonSimpleRun from 'phosphor-svelte/lib/PersonSimpleRun';
	import Mountains from 'phosphor-svelte/lib/Mountains';
	import SneakerMove from 'phosphor-svelte/lib/SneakerMove';
	import Bicycle from 'phosphor-svelte/lib/Bicycle';
	import PersonSimpleSwim from 'phosphor-svelte/lib/PersonSimpleSwim';
	import SwimmingPool from 'phosphor-svelte/lib/SwimmingPool';
	import PersonSimpleHike from 'phosphor-svelte/lib/PersonSimpleHike';
	import PersonSimpleWalk from 'phosphor-svelte/lib/PersonSimpleWalk';
	import PersonSimpleSki from 'phosphor-svelte/lib/PersonSimpleSki';
	import PersonSimpleTaiChi from 'phosphor-svelte/lib/PersonSimpleTaiChi';
	import Barbell from 'phosphor-svelte/lib/Barbell';
	import Timer from 'phosphor-svelte/lib/Timer';
	import TrendUp from 'phosphor-svelte/lib/TrendUp';
	import Heartbeat from 'phosphor-svelte/lib/Heartbeat';
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
		onNavigate?: (activityId: number) => void;
	}

	let { activity, splits = [], weather = null, hrZones, loadColor, context, expanded = false, ontoggle, onNavigate }: Props = $props();

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
		const wk = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/Paris' });
		const dm = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Europe/Paris' });
		return `${wk} ${dm}`;
	}

	function fmtTime(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Paris' });
	}

	function badgeColor(label: string | null): string {
		if (!label) return C.textDim;
		const l = label.toUpperCase();
		if (l.includes('INTERVAL') || l.includes('SPEED') || l.includes('VO2MAX')) return C.purple;
		if (l.includes('TEMPO') || l.includes('THRESHOLD')) return C.orange;
		if (l.includes('RECOVERY') || l.includes('BASE')) return C.cyan;
		if (l.includes('LONG')) return C.cyan;
		return C.cyan;
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
		const paceSeconds = Math.round(1000 / speed);
		const m = Math.floor(paceSeconds / 60);
		const s = paceSeconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function isTrail(a: Activity): boolean {
		if (!a.elevation_gain || !a.distance_meters || a.distance_meters < 1000) return false;
		return a.elevation_gain / (a.distance_meters / 1000) > 15;
	}

	function zoneData(a: Activity): { pcts: number[]; times: number[]; total: number } {
		const times = [
			a.hr_time_in_zone_1 ?? 0, a.hr_time_in_zone_2 ?? 0,
			a.hr_time_in_zone_3 ?? 0, a.hr_time_in_zone_4 ?? 0, a.hr_time_in_zone_5 ?? 0,
		];
		const total = times.reduce((s, v) => s + v, 0);
		return { pcts: times.map(z => total > 0 ? z / total * 100 : 0), times, total };
	}

	function zoneTooltipHtml(z: { pcts: number[]; times: number[]; total: number }): string {
		let html = '<table style="border-spacing:8px 1px">';
		for (let i = 0; i < 5; i++) {
			if (z.times[i] <= 0) continue;
			const m = Math.floor(z.times[i] / 60);
			const s = Math.floor(z.times[i] % 60).toString().padStart(2, '0');
			const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ZONE_COLORS[i]};margin-right:2px"></span>`;
			html += `<tr><td>${dot}Z${i + 1}&nbsp;</td><td style="text-align:right"><b>${m}:${s}</b>&nbsp;</td><td style="text-align:right;color:${C.textDim}">${Math.round(z.pcts[i])}%</td></tr>`;
		}
		html += '</table>';
		return html;
	}

	function weatherType(desc: string | undefined): 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm' | 'moon' {
		if (!desc) return 'cloud';
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
	function parsePace(s: ActivitySplit): number {
		if (s.pace_seconds && s.pace_seconds > 0) return s.pace_seconds;
		if (!s.pace) return 0;
		const m = s.pace.match(/^(\d+):(\d+)/);
		return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
	}
	const sparkBars = $derived(
		(splits && splits.length >= 2)
			? splits.map(s => ({ pace: parsePace(s), dist: s.distance_meters, hr: s.avg_hr })).filter(b => b.pace > 0 && b.dist > 0)
			: []
	);
	const paceMin = $derived(sparkBars.length > 0 ? arrMin(sparkBars.map(b => b.pace)) : 0);
	const paceMax = $derived(sparkBars.length > 0 ? arrMax(sparkBars.map(b => b.pace)) : 0);
	const paceRange = $derived(paceMax - paceMin || 1);
	const maxDist = $derived(sparkBars.length > 0 ? arrMax(sparkBars.map(b => b.dist)) : 1);

	function teValueColor(te: number): string {
		if (te >= 4.0) return C.purple;
		if (te >= 3.0) return C.orange;
		if (te >= 1.0) return C.cyan;
		return C.textDim;
	}

	function scrollToActivity() {
		const el = document.getElementById(`activity-${activity.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<button
	type="button"
	class="w-full text-left px-3 md:px-4 py-3 cursor-pointer hover:bg-card-border/20 transition-colors rounded-lg"
	onclick={() => { if (context === 'feed') ontoggle?.(); else if (onNavigate) onNavigate(activity.id); else scrollToActivity(); }}
>
	<!-- Row 1: Name + badge + weather + date -->
	<div class="flex items-center gap-2.5 mb-1.5 leading-5">
		<span class="shrink-0 leading-[0]" style="color: {teColor};">
			{#if activity.activity_type === 'trail_running'}
				<Mountains size={16} weight="bold" />
			{:else if activity.activity_type === 'treadmill_running'}
				<SneakerMove size={16} weight="bold" />
			{:else if activity.activity_type === 'cycling' || activity.activity_type === 'indoor_cycling'}
				<Bicycle size={16} weight="bold" />
			{:else if activity.activity_type === 'swimming'}
				<SwimmingPool size={16} weight="bold" />
			{:else if activity.activity_type === 'open_water_swimming'}
				<PersonSimpleSwim size={16} weight="bold" />
			{:else if activity.activity_type === 'hiking'}
				<PersonSimpleHike size={16} weight="bold" />
			{:else if activity.activity_type === 'walking'}
				<PersonSimpleWalk size={16} weight="bold" />
			{:else if activity.activity_type === 'strength_training'}
				<Barbell size={16} weight="bold" />
			{:else if activity.activity_type === 'cardio_training'}
				<Heartbeat size={16} weight="bold" />
			{:else if activity.activity_type === 'yoga'}
				<PersonSimpleTaiChi size={16} weight="bold" />
			{:else if activity.activity_type === 'resort_skiing' || activity.activity_type === 'backcountry_skiing'}
				<PersonSimpleSki size={16} weight="bold" />
			{:else}
				<PersonSimpleRun size={16} weight="bold" />
			{/if}
		</span>
		<span class="shrink-0 num text-[10px] font-bold leading-[0] -ml-1" style="color: {teColor};">
			{#if te}
				<Tip text={te.name + '\n' + te.desc}>{te.code}</Tip>
			{/if}
		</span>
		<div class="min-w-0 flex-1">
			{#if editingTitle}
				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="w-full bg-transparent text-sm font-medium text-text border-b border-blue-500/50 outline-none py-0"
					bind:value={editTitle}
					onblur={saveTitle}
					onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { editingTitle = false; } }}
					onclick={(e: MouseEvent) => e.stopPropagation()}
					autofocus
				/>
			{:else}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="font-medium text-text text-sm truncate"
					ondblclick={startEditTitle}
				>{displayName}</div>
			{/if}
		</div>
		<span class="shrink-0 flex items-center gap-2 text-[10px] text-text-dim num">
			{fmtDate(activity.start_time)} {fmtTime(activity.start_time)}
			{#if activity.location_name}
				<span class="hidden md:inline text-[10px] text-text-dim">· {activity.location_name}</span>
			{/if}
			{#if weather?.weather_description}
				{@const wt = weatherType(weather.weather_description)}
				<span class="text-text-dim">·</span>
				<Tip text={`${weather.weather_description}\n${Math.round(weather.temperature_celsius ?? 0)}°C (feels ${Math.round(weather.feels_like_celsius ?? 0)}°C)\nWind ${Math.round(weather.wind_speed_kmh ?? 0)} km/h ${weather.wind_direction_compass ?? ''}\nHumidity ${Math.round(weather.humidity_percent ?? 0)}%`}>
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
				<span class="text-text-dim">
					<CaretDown size={12} weight="bold" class="transition-transform {expanded ? 'rotate-180' : ''}" />
				</span>
			{:else}
				<span class="text-text-dim">
					<ArrowSquareOut size={14} weight="bold" />
				</span>
			{/if}
		</span>
	</div>

	<!-- Row 2: Metrics -->
	<div class="flex flex-wrap items-end gap-x-3 gap-y-1.5 text-xs leading-none">
		<span class="num text-text font-semibold shrink-0">{formatDistance(activity.distance_meters)}<span class="text-text-dim font-normal">km</span></span>
		<span class="num text-text-secondary shrink-0">{Math.floor(activity.duration_seconds / 3600)}:{Math.floor((activity.duration_seconds % 3600) / 60).toString().padStart(2, '0')}:{Math.floor(activity.duration_seconds % 60).toString().padStart(2, '0')}</span>
		{#if trail && activity.avg_grade_adjusted_speed}
			<span class="num shrink-0 inline-flex items-center gap-0.5" style="color: {C.teal}" title="Grade Adjusted Pace — equivalent effort on flat ground"><Timer size={11} weight="bold" />{speedToPace(activity.avg_grade_adjusted_speed)}</span>
		{:else if activity.pace_min_km}
			<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5" title="Average pace"><Timer size={11} weight="bold" />{activity.pace_min_km.replace(' /km', '')}</span>
		{/if}
		{#if trail}
			<span class="num text-text-secondary shrink-0 inline-flex items-center gap-0.5"><TrendUp size={11} weight="bold" />{activity.elevation_gain}m</span>
		{/if}
		{#if activity.avg_hr}
			<span class="num text-text-secondary shrink-0 inline-flex items-center gap-px"><Heartbeat size={12} weight="bold" />{activity.avg_hr}{#if activity.max_hr}<span class="hidden sm:inline text-text-dim">/{activity.max_hr}</span>{/if}</span>
		{/if}

		<!-- Right group: sparkline + load + zones -->
		<span class="flex items-end gap-3 shrink-0 w-full sm:w-auto sm:ml-auto">
			{#if sparkBars.length >= 2}
				<div class="flex items-end gap-px h-3" title="Pace per split">
					{#each sparkBars as b}
						{@const pct = 20 + ((b.pace - paceMin) / paceRange) * 80}
						{@const w = Math.max(1, Math.round((b.dist / maxDist) * 6))}
						<div class="rounded-t-sm" style="height: {pct}%; width: {w}px; background: {hrZoneColor(b.hr, hrZones)};"></div>
					{/each}
				</div>
			{/if}

			{#if activity.activity_training_load != null}
				<Tip text={'Training Load\n4-week cumulative training stress from this session.\nHigher = more demanding.'}>
					<span class="flex items-end gap-0.5 num font-bold text-text-secondary leading-none">
						<Flame size={12} weight="bold" />
						{Math.round(activity.activity_training_load)}
					</span>
				</Tip>
			{/if}
			<Tip text={'Aerobic TE ' + (activity.aerobic_training_effect ?? 0).toFixed(1) + '\n' + (activity.aerobic_training_effect_message?.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase() ?? '')}>
				<span class="num text-xs font-semibold leading-none" style="color: {teValueColor(activity.aerobic_training_effect ?? 0)}">{(activity.aerobic_training_effect ?? 0).toFixed(1)}</span>
			</Tip>
			<Tip text={'Anaerobic TE ' + (activity.anaerobic_training_effect ?? 0).toFixed(1) + '\n' + (activity.anaerobic_training_effect_message?.replace(/_\d+$/, '').replace(/_/g, ' ').toLowerCase() ?? '')}>
				<span class="num text-xs font-semibold leading-none" style="color: {teValueColor(activity.anaerobic_training_effect ?? 0)}">{(activity.anaerobic_training_effect ?? 0).toFixed(1)}</span>
			</Tip>

			{#if zones.total > 0}
				{@const maxPct = arrMax(zones.pcts)}
				<Tip text="" html={zoneTooltipHtml(zones)}>
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
</button>
