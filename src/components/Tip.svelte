<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	interface Props {
		text: string;
		mono?: boolean;
		children: Snippet;
	}

	let { text, mono = false, children }: Props = $props();
	let show = $state(false);
	let tipEl = $state<HTMLSpanElement>();
	let style = $state('');

	async function reposition() {
		show = true;
		await tick();
		if (!tipEl) return;

		const rect = tipEl.getBoundingClientRect();
		const pad = 8;
		let xShift = 0;

		// Clamp horizontally
		if (rect.left < pad) {
			xShift = pad - rect.left;
		} else if (rect.right > window.innerWidth - pad) {
			xShift = window.innerWidth - pad - rect.right;
		}

		// If tooltip goes above viewport, flip below
		if (rect.top < pad) {
			style = `transform: translateX(calc(-50% + ${xShift}px)); top: calc(100% + 8px); bottom: auto;`;
		} else {
			style = xShift !== 0 ? `transform: translateX(calc(-50% + ${xShift}px));` : '';
		}
	}

	function hide() {
		show = false;
		style = '';
	}
</script>

<span
	class="tip-trigger"
	role="note"
	onmouseenter={reposition}
	onmouseleave={hide}
>
	{@render children()}
	{#if show}
		<span class="tip-content" class:mono bind:this={tipEl} {style}>
			{#each text.split('\n') as line, i}
				{#if i > 0}<br/>{/if}{line}
			{/each}
		</span>
	{/if}
</span>

<style>
	.tip-trigger {
		position: relative;
		cursor: help;
	}
	.tip-content {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
		width: max-content;
		max-width: 340px;
		padding: 8px 12px;
		border-radius: 6px;
		background: #1e1e2a;
		border: 1px solid #2a2a3a;
		color: #c8c8d4;
		font-size: 11px;
		line-height: 1.6;
		font-weight: 400;
		white-space: normal;
		pointer-events: none;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	}
	.tip-content.mono {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		white-space: pre;
	}
</style>
