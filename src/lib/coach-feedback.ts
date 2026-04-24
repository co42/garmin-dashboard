const LABELS: Record<string, string> = {
	IMPROVED_VO2MAX: 'Improved VO2 Max',
	IMPROVE_LONG_TERM_MILEAGE_0: 'Building mileage',
	IMPROVE_LONG_TERM_MILEAGE_1: 'Building mileage',
	IMPROVE_LONG_TERM_MILEAGE_2: 'Building mileage',
};

export function feedbackLabel(phrase: string | null): string {
	if (!phrase) return '';
	const mapped = LABELS[phrase];
	if (mapped) return mapped;
	return phrase
		.toLowerCase()
		.replace(/_/g, ' ')
		.replace(/\b\w/g, c => c.toUpperCase());
}
