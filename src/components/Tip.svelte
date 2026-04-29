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
	let positioned = $state(false);
	let tipEl = $state<HTMLSpanElement>();
	let triggerEl = $state<HTMLSpanElement>();
	let pos = $state({ left: '0px', top: '0px' });

	// `(hover: none)` covers mobile / pure-touch. On hybrid devices the click
	// handler is also active, so a tap still works there.
	const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;

	async function open() {
		if (show) return;
		positioned = false;
		show = true;
		// Attach dismissal listeners synchronously while the tooltip is open
		// — using $effect was causing a timing window where a tap fired before
		// the listeners were live.
		document.addEventListener('pointerdown', onDocPointerDown, true);
		document.addEventListener('keydown', onKey);
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onScroll);
		await tick();
		reposition();
		positioned = true;
	}

	function close() {
		if (!show) return;
		show = false;
		positioned = false;
		document.removeEventListener('pointerdown', onDocPointerDown, true);
		document.removeEventListener('keydown', onKey);
		window.removeEventListener('scroll', onScroll, true);
		window.removeEventListener('resize', onScroll);
	}

	function toggle() {
		if (show) close(); else open();
	}

	function reposition() {
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

	function onClick(e: MouseEvent) {
		// On hover-capable devices, mouseenter/leave already drives open/close —
		// a click on the trigger should pass through (so inner buttons / links
		// keep working normally).
		if (!isTouch) return;
		// Don't toggle if the tap landed on an interactive child of the trigger
		// (legend toggle button, link, …): let the child's own onclick win.
		const target = e.target as HTMLElement;
		const innerControl = target.closest('button, a, input, [role="button"]');
		if (innerControl && innerControl !== triggerEl && triggerEl?.contains(innerControl)) return;
		toggle();
	}

	function onDocPointerDown(e: PointerEvent) {
		const target = e.target as Node | null;
		if (!target) return;
		// Tap inside the trigger → leave it to the trigger's own onclick (which
		// either toggles or no-ops). Anywhere else closes.
		if (triggerEl?.contains(target)) return;
		close();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function onScroll() {
		// The tooltip is position:fixed; the trigger may scroll out from under
		// it. Closing is simpler and more honest than tracking it.
		close();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<span
	class="tip-trigger"
	role="note"
	bind:this={triggerEl}
	onmouseenter={isTouch ? undefined : open}
	onmouseleave={isTouch ? undefined : close}
	onclick={onClick}
>
	{@render children()}
</span>
{#if show}
	<span
		class="tip-content"
		class:mono
		class:positioned
		bind:this={tipEl}
		style="left:{pos.left};top:{pos.top}"
	>
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
		/* Hidden until reposition has run, so we don't see it flash at 0,0 on
		   the first open. */
		visibility: hidden;
	}
	.tip-content.positioned {
		visibility: visible;
	}
	.tip-content.mono {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		white-space: pre;
	}
</style>
