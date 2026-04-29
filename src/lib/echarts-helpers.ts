/**
 * Document-level dismiss for an ECharts tooltip: a `pointerdown` outside the
 * chart container closes the tooltip via `dispatchAction({ type: 'hideTip' })`.
 *
 * ECharts shows tooltips on tap on touch devices but doesn't auto-dismiss on
 * outside-click. Without this hook, a tapped tooltip persists indefinitely
 * (only replaced when the user taps another data point on the same chart).
 *
 * Usage in a chart component's onMount, after `echarts.init()`:
 *
 *   const cleanup = bindTooltipOutsideClick(chart, chartEl);
 *   onDestroy(cleanup);
 */
export function bindTooltipOutsideClick(chart: any, container: HTMLElement): () => void {
	const handler = (e: PointerEvent) => {
		const target = e.target as Node | null;
		if (!target || container.contains(target)) return;
		chart?.dispatchAction({ type: 'hideTip' });
	};
	// Capture phase so we run before any inner handler can stop propagation.
	document.addEventListener('pointerdown', handler, true);
	return () => document.removeEventListener('pointerdown', handler, true);
}
