import { today as fmtToday } from './dates.js';

// Reactive "today" YYYY-MM-DD (Europe/Paris). One module-shared store. Auto-
// updates at midnight via a 60s tick + on tab visibility, so countdowns,
// "Xd ago" labels, and the today-marker stay correct without a page reload.
class TodayStore {
	#value = $state(fmtToday());

	constructor() {
		if (typeof window === 'undefined') return;
		setInterval(() => {
			const next = fmtToday();
			if (next !== this.#value) this.#value = next;
		}, 60_000);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'visible') return;
			const next = fmtToday();
			if (next !== this.#value) this.#value = next;
		});
	}

	get current() { return this.#value; }
}

export const todayStore = new TodayStore();
