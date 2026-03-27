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

	onDestroy(() => { _map?.remove(); });

	onMount(async () => {
		const maplibregl = (await import('maplibre-gl')).default;

		// Convert [lat, lon] to [lon, lat] for MapLibre
		const coords = polyline.map(([lat, lon]) => [lon, lat] as [number, number]);
		if (coords.length === 0) return;

		// Compute bounds
		let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
		for (const [lon, lat] of coords) {
			if (lon < minLon) minLon = lon;
			if (lon > maxLon) maxLon = lon;
			if (lat < minLat) minLat = lat;
			if (lat > maxLat) maxLat = lat;
		}

		const centerLon = (minLon + maxLon) / 2;
		const centerLat = (minLat + maxLat) / 2;

		_map = new maplibregl.Map({
			container: mapEl,
			style: 'https://api.maptiler.com/maps/outdoor-v2-dark/style.json?key=ZuAr9fwLm91IzJLZq7s8',
			center: [centerLon, centerLat],
			zoom: 12,
			interactive: true,
			attributionControl: false,
		});

		_map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

		_map.on('load', () => {
			// Hide noisy layers (admin boundaries, land use, colored trails)
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
			// Also hide any admin/boundary layers by pattern
			for (const layer of _map.getStyle().layers) {
				if (layer.id.toLowerCase().includes('admin') || layer.id.toLowerCase().includes('boundary')) {
					_map.setLayoutProperty(layer.id, 'visibility', 'none');
				}
			}

			// Fit bounds with padding
			_map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 24, duration: 0 });

			// Route line
			_map.addSource('route', {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: { type: 'LineString', coordinates: coords },
				},
			});

			// Route casing (white outline for contrast)
			_map.addLayer({
				id: 'route-casing',
				type: 'line',
				source: 'route',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': '#ffffff',
					'line-width': 5,
					'line-opacity': 0.4,
				},
			});

			// Route line
			_map.addLayer({
				id: 'route-line',
				type: 'line',
				source: 'route',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': C.blue,
					'line-width': 3,
					'line-opacity': 0.9,
				},
			});

			// Start marker
			const startEl = document.createElement('div');
			startEl.style.cssText = `width:10px;height:10px;border-radius:50%;background:${C.green};border:2px solid white;`;
			new maplibregl.Marker({ element: startEl })
				.setLngLat(coords[0])
				.addTo(_map);

			// End marker
			const endEl = document.createElement('div');
			endEl.style.cssText = `width:10px;height:10px;border-radius:50%;background:${C.red};border:2px solid white;`;
			new maplibregl.Marker({ element: endEl })
				.setLngLat(coords[coords.length - 1])
				.addTo(_map);
		});
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
