import type { PageServerLoad } from './$types';
import type { DashboardData } from '$lib/types.js';
import {
	fetchTrainingStatus,
	fetchReadiness,
	fetchRacePredictions,
	fetchEnduranceScore,
	fetchFitnessAge,
	fetchLactateThreshold,
	fetchHrv,
	fetchActivities,
} from '$lib/garmin.js';
import { daysBetween } from '$lib/format.js';

export const load: PageServerLoad = async (): Promise<DashboardData> => {
	const [
		trainingStatus,
		readiness,
		racePredictions,
		enduranceScore,
		fitnessAge,
		lactateThreshold,
		hrv,
		activities,
	] = await Promise.all([
		fetchTrainingStatus(),
		fetchReadiness(),
		fetchRacePredictions(),
		fetchEnduranceScore(),
		fetchFitnessAge(),
		fetchLactateThreshold(),
		fetchHrv(),
		fetchActivities(),
	]);

	const lastRunDate = activities.length > 0 ? activities[0].start_time : null;
	const daysSinceLastRun = lastRunDate
		? daysBetween(lastRunDate, new Date().toISOString())
		: null;

	return {
		trainingStatus,
		readiness,
		racePredictions,
		enduranceScore,
		fitnessAge,
		lactateThreshold,
		hrv,
		activities,
		lastRunDate,
		daysSinceLastRun,
	};
};
