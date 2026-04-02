<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Training Dashboard</title>
</svelte:head>

<div class="min-h-dvh bg-bg overflow-x-hidden">
	{@render children()}
</div>
