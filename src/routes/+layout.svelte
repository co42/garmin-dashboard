<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Training Dashboard</title>
</svelte:head>

<div class="min-h-dvh bg-bg">
	<header class="border-b border-card-border px-6 py-4">
		<h1 class="text-lg font-semibold tracking-tight text-text">Training Dashboard</h1>
	</header>
	<main class="mx-auto max-w-[1400px] p-4 md:p-6">
		{@render children()}
	</main>
</div>
