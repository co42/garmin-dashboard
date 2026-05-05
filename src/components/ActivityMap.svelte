<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { C } from '$lib/colors.js';
	import 'maplibre-gl/dist/maplibre-gl.css';

	interface Props {
		polyline: [number, number][]; // [lat, lon][]
	}

	let { polyline }: Props = $props();
	let mapEl: HTMLDivElement;
	let _map: any;
	let _maplibre: any;
	let _styleReady = false;
	let _markers: any[] = [];

	onDestroy(() => {
		for (const m of _markers) m.remove();
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

	function applyRoute(coords: [number, number][]) {
		if (!_map || !_styleReady) return;
		// Markers — wipe + replace; cheap.
		for (const m of _markers) m.remove();
		_markers = [];
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
		_markers.push(new _maplibre.Marker({ element: startEl }).setLngLat(coords[0]).addTo(_map));
		const endEl = document.createElement('div');
		endEl.style.cssText = `width:10px;height:10px;border-radius:50%;background:${C.red};border:2px solid white;`;
		_markers.push(new _maplibre.Marker({ element: endEl }).setLngLat(coords[coords.length - 1]).addTo(_map));
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
		});
	});

	$effect(() => {
		if (!_styleReady) return;
		applyRoute(polyline.map(([lat, lon]) => [lon, lat] as [number, number]));
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
