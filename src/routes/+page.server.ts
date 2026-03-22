import type { PageServerLoad } from './$types';
import type { DashboardData } from '$lib/types.js';
import { loadDashboard } from '$lib/queries.js';

export const load: PageServerLoad = async (): Promise<{ dashboard: DashboardData | null }> => {
	return { dashboard: loadDashboard() };
};
