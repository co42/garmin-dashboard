<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	interface Props {
		text: string;
		html?: string;
		mono?: boolean;
		children: Snippet;
	}

	let { text, html, mono = false, children }: Props = $props();
	let show = $state(false);
	let tipEl = $state<HTMLSpanElement>();
	let triggerEl = $state<HTMLSpanElement>();
	let pos = $state({ left: '0px', top: '0px' });

	async function reposition() {
		show = true;
		await tick();
		if (!tipEl || !triggerEl) return;

		const tr = triggerEl.getBoundingClientRect();
		const tip = tipEl.getBoundingClientRect();
		const pad = 8;

		// Center horizontally on trigger, clamp to viewport
		let left = tr.left + tr.width / 2 - tip.width / 2;
		if (left < pad) left = pad;
		if (left + tip.width > window.innerWidth - pad) left = window.innerWidth - pad - tip.width;

		// Above trigger by default, flip below if no room
		let top = tr.top - tip.height - 8;
		if (top < pad) top = tr.bottom + 8;

		pos = { left: `${left}px`, top: `${top}px` };
	}

	function hide() {
		show = false;
	}
</script>

<span
	class="tip-trigger"
	role="note"
	bind:this={triggerEl}
	onmouseenter={reposition}
	onmouseleave={hide}
>
	{@render children()}
</span>
{#if show}
	<span class="tip-content" class:mono bind:this={tipEl} style="left:{pos.left};top:{pos.top}">
		{#if html}
			{@html html}
		{:else}
			{#each text.split('\n') as line, i}
				{#if i > 0}<br/>{/if}{line}
			{/each}
		{/if}
	</span>
{/if}

<style>
	.tip-trigger {
		position: relative;
		cursor: help;
	}
	.tip-content {
		position: fixed;
		z-index: 50;
		width: max-content;
		max-width: min(340px, calc(100vw - 24px));
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
