<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Training Dashboard</title>
</svelte:head>

<Toaster
	theme="dark"
	position="top-right"
	closeButton
	toastOptions={{ duration: 300000 }}
/>

<div class="min-h-dvh bg-bg overflow-x-hidden">
	{@render children()}
</div>
