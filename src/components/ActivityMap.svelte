<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ActivityDetailPoint } from '$lib/types.js';
	import { C } from '$lib/colors.js';
	import 'maplibre-gl/dist/maplibre-gl.css';

	interface Props {
		polyline: [number, number][]; // [lat, lon][]
		// Optional time-series — when provided, per-km markers are drawn at the
		// interpolated lat/lon for every whole-km mark, and `hoverDist` can be
		// used to surface a follower marker tied to a chart's axis pointer.
		timeseries?: ActivityDetailPoint[];
		// Cumulative distance in meters of the chart's currently-hovered point.
		// `null` (or unset) hides the hover marker.
		hoverDist?: number | null;
	}

	let { polyline, timeseries = [], hoverDist = null }: Props = $props();

	let mapEl: HTMLDivElement;
	let _map: any;
	let _maplibre: any;
	// Reactive: every consumer of "is the map ready" relies on this flipping
	// from false to true triggering a re-run. Plain let won't do — $effect
	// only tracks reactive reads.
	let _styleReady = $state(false);
	// Route-related markers: start, end, per-km. Hover marker tracked
	// separately because it updates on every cursor move.
	let _routeMarkers: any[] = [];
	let _hoverMarker: any = null;
	let _hoverEl: HTMLDivElement | null = null;

	onDestroy(() => {
		for (const m of _routeMarkers) m.remove();
		_hoverMarker?.remove();
		_map?.remove();
	});

	function bounds(coords: [number, number][]): [[number, number], [number, number]] | null {
		if (coords.length === 0) return null;
		let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
		for (const [lon, lat] of coords) {
			if (lon < minLon) minLon = lon;
			if (lon > maxLon) maxLon = lon;
			if (lat < minLat) minLat = lat;
			if (lat > maxLat) maxLat = lat;
		}
		return [[minLon, minLat], [maxLon, maxLat]];
	}

	function kmStepFor(totalKm: number): number {
		if (totalKm > 50) return 5;
		if (totalKm > 25) return 2;
		return 1;
	}

	// GPS-only points; the linear interpolation skips holes from sensor dropouts.
	function gpsPoints(): ActivityDetailPoint[] {
		return timeseries.filter(p => p.lat != null && p.lon != null);
	}

	function pointAtDistance(target: number, gps: ActivityDetailPoint[]): [number, number] | null {
		if (gps.length < 2) return null;
		for (let i = 1; i < gps.length; i++) {
			const a = gps[i - 1];
			const b = gps[i];
			if (b.dist >= target) {
				const span = b.dist - a.dist;
				if (span <= 0) return [a.lon as number, a.lat as number];
				const t = Math.max(0, Math.min(1, (target - a.dist) / span));
				return [
					(a.lon as number) + ((b.lon as number) - (a.lon as number)) * t,
					(a.lat as number) + ((b.lat as number) - (a.lat as number)) * t,
				];
			}
		}
		const last = gps[gps.length - 1];
		return [last.lon as number, last.lat as number];
	}

	function makeKmMarkerEl(km: number): HTMLDivElement {
		const el = document.createElement('div');
		// Inline styles — Svelte's scoped CSS doesn't reach maplibre-managed DOM
		// reliably across browsers, and this avoids the :global() escape hatch.
		el.style.cssText = [
			'display:flex',
			'align-items:center',
			'justify-content:center',
			'min-width:18px',
			'height:18px',
			'padding:0 4px',
			'border-radius:9px',
			'background:rgba(255,255,255,0.92)',
			'color:#13131a',
			"font-family:'Geist Mono Variable', ui-monospace, monospace",
			'font-size:10px',
			'font-weight:700',
			'line-height:1',
			'box-shadow:0 1px 2px rgba(0,0,0,0.4)',
			'pointer-events:none',
			'user-select:none',
		].join(';');
		el.textContent = String(km);
		return el;
	}

	function makeHoverEl(): HTMLDivElement {
		const el = document.createElement('div');
		el.style.cssText = [
			'width:14px',
			'height:14px',
			'border-radius:50%',
			`background:${C.amber}`,
			'border:2px solid white',
			'box-shadow:0 0 0 2px rgba(245,158,11,0.35), 0 1px 4px rgba(0,0,0,0.5)',
			'pointer-events:none',
		].join(';');
		return el;
	}

	function applyRoute(coords: [number, number][]) {
		if (!_map || !_styleReady) return;
		for (const m of _routeMarkers) m.remove();
		_routeMarkers = [];
		const b = bounds(coords);
		if (!b || coords.length === 0) {
			const src = _map.getSource('route');
			if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
			return;
		}
		const src = _map.getSource('route');
		const data = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
		if (src) {
			src.setData(data);
		} else {
			_map.addSource('route', { type: 'geojson', data });
			_map.addLayer({
				id: 'route-casing', type: 'line', source: 'route',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.4 },
			});
			_map.addLayer({
				id: 'route-line', type: 'line', source: 'route',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': C.blue, 'line-width': 3, 'line-opacity': 0.9 },
			});
		}
		_map.fitBounds(b, { padding: 24, duration: 0 });

		const startEl = document.createElement('div');
		startEl.style.cssText = `width:10px;height:10px;border-radius:50%;background:${C.green};border:2px solid white;`;
		_routeMarkers.push(new _maplibre.Marker({ element: startEl }).setLngLat(coords[0]).addTo(_map));
		const endEl = document.createElement('div');
		endEl.style.cssText = `width:10px;height:10px;border-radius:50%;background:${C.red};border:2px solid white;`;
		_routeMarkers.push(new _maplibre.Marker({ element: endEl }).setLngLat(coords[coords.length - 1]).addTo(_map));

		const gps = gpsPoints();
		if (gps.length >= 2) {
			const totalKm = gps[gps.length - 1].dist / 1000;
			const step = kmStepFor(totalKm);
			for (let km = step; km < totalKm; km += step) {
				const pos = pointAtDistance(km * 1000, gps);
				if (!pos) continue;
				_routeMarkers.push(
					new _maplibre.Marker({ element: makeKmMarkerEl(km), anchor: 'center' }).setLngLat(pos).addTo(_map)
				);
			}
		}
	}

	function applyHover(target: number | null) {
		if (!_map || !_styleReady) return;
		const gps = gpsPoints();
		if (target == null || gps.length < 2) {
			if (_hoverEl) _hoverEl.style.display = 'none';
			return;
		}
		const pos = pointAtDistance(target, gps);
		if (!pos) {
			if (_hoverEl) _hoverEl.style.display = 'none';
			return;
		}
		if (!_hoverMarker) {
			_hoverEl = makeHoverEl();
			_hoverMarker = new _maplibre.Marker({ element: _hoverEl, anchor: 'center' }).setLngLat(pos).addTo(_map);
		} else {
			_hoverEl!.style.display = '';
			_hoverMarker.setLngLat(pos);
		}
	}

	onMount(async () => {
		_maplibre = (await import('maplibre-gl')).default;
		_map = new _maplibre.Map({
			container: mapEl,
			style: 'https://api.maptiler.com/maps/outdoor-v2-dark/style.json?key=ZuAr9fwLm91IzJLZq7s8',
			zoom: 12,
			interactive: true,
			attributionControl: false,
		});
		_map.addControl(new _maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
		_map.on('load', () => {
			const HIDDEN = [
				'Park outline', 'Forest', 'Wood',
				'Trails outline', 'Other trails',
				'Yellow trail', 'Green trail', 'Blue trail', 'Brown trail',
				'Black trail', 'Purple trail', 'Orange trail', 'Red trail',
				'Longdistance trail', 'Via ferrata',
				'Bicycle outline', 'Bicycle local', 'Bicycle longdistance',
			];
			for (const id of HIDDEN) {
				if (_map.getLayer(id)) _map.setLayoutProperty(id, 'visibility', 'none');
			}
			for (const layer of _map.getStyle().layers) {
				if (layer.id.toLowerCase().includes('admin') || layer.id.toLowerCase().includes('boundary')) {
					_map.setLayoutProperty(layer.id, 'visibility', 'none');
				}
			}
			_styleReady = true;
			applyRoute(polyline.map(([lat, lon]) => [lon, lat] as [number, number]));
			applyHover(hoverDist);
		});
	});

	$effect(() => {
		// Read tracked deps up-front so the effect re-runs when any of them
		// changes — even on the first pass when the map isn't ready yet.
		const ready = _styleReady;
		const pl = polyline;
		// Touch timeseries so per-km markers refresh when it changes.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		timeseries;
		if (!ready) return;
		applyRoute(pl.map(([lat, lon]) => [lon, lat] as [number, number]));
	});

	$effect(() => {
		const ready = _styleReady;
		const target = hoverDist;
		if (!ready) return;
		applyHover(target);
	});
</script>

<div bind:this={mapEl} class="map-container h-full w-full rounded"></div>

<style>
	.map-container :global(.maplibregl-ctrl-group) {
		background: #13131a;
		border: 1px solid #1e1e2a;
	}
	.map-container :global(.maplibregl-ctrl-group button) {
		background: transparent;
		border-color: #1e1e2a;
	}
	.map-container :global(.maplibregl-ctrl-group button span) {
		filter: invert(1);
	}
</style>
