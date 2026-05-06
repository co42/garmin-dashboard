import type { Activity } from './types.js';
import { C } from './colors.js';

// Single source of truth for activity / workout badges. Both the activity feed
// (completed runs) and the upcoming-week calendar (scheduled workouts) classify
// into the same set of categories so a workout's color matches its done-form.
//
// Colors track Garmin's Load Balance bar:
//   • Low aerobic   (recovery / base / long / easy)        → blue   (LOAD_COLORS.aeroLow)
//   • High aerobic  (tempo / threshold / vo2max / interval) → orange (LOAD_COLORS.aeroHigh)
//   • Anaerobic     (sprint / speed / anaerobic / strength) → purple (LOAD_COLORS.anaerobic)
//   • Cross-train   (cycle / swim / hike / yoga / etc.)    → teal
//   • Rest / unknown                                       → dim
//
// VO2max sits in High Aerobic, not Anaerobic — Garmin classifies it that way
// because the load comes from sustained near-max HR (aerobic system), not from
// anaerobic energy. Verified against the dashboard's own DB:
//   training_effect_label='VO2MAX' rows have aerobic_te ~4.5–5.0 with
//   "HIGHLY_IMPROVING_VO2_MAX" message and anaerobic_te ~0.

export type Badge = { code: string; name: string; desc: string; color: string };

const BADGES = {
	rest:      { code: 'RS', name: 'Rest',         desc: 'Rest day — no training scheduled.',                                          color: C.textDim },
	recovery:  { code: 'RC', name: 'Recovery',     desc: 'Very low intensity. Promotes blood flow and recovery without adding load.', color: C.blue },
	base:      { code: 'AB', name: 'Aerobic Base', desc: 'Easy effort building your aerobic foundation — the engine behind everything.', color: C.blue },
	long:      { code: 'LR', name: 'Long Run',     desc: 'Extended duration at easy-to-moderate pace. Builds endurance and fat metabolism.', color: C.blue },
	tempo:     { code: 'TP', name: 'Tempo',        desc: 'Comfortably hard effort near lactate threshold. Builds speed endurance.',  color: C.orange },
	threshold: { code: 'TH', name: 'Threshold',    desc: 'Sustained effort at or near lactate threshold. Raises your ceiling pace.', color: C.orange },
	vo2:       { code: 'VO', name: 'VO2max',       desc: 'Hard intervals targeting maximal oxygen uptake. Builds top-end aerobic power.', color: C.orange },
	interval:  { code: 'IT', name: 'Interval',     desc: 'High-intensity repeats with recovery. Improves speed endurance.',         color: C.orange },
	speed:     { code: 'SP', name: 'Speed',        desc: 'Short, fast efforts developing neuromuscular power and running economy.', color: C.purple },
	anaerobic: { code: 'AN', name: 'Anaerobic',    desc: 'All-out efforts above threshold. Builds anaerobic capacity and power.',  color: C.purple },
	strength:  { code: 'ST', name: 'Strength',     desc: 'Resistance / weightlifting session. Counts as anaerobic load.',            color: C.purple },
	cardio:    { code: 'CD', name: 'Cardio',       desc: 'Indoor cardio session.',                                                   color: C.orange },
	hike:      { code: 'HK', name: 'Hike',         desc: 'Hiking session — cross-training.',                                         color: C.teal },
	walk:      { code: 'WK', name: 'Walk',         desc: 'Walking session — cross-training.',                                        color: C.teal },
	cycle:     { code: 'CY', name: 'Cycle',        desc: 'Cycling session — cross-training.',                                        color: C.teal },
	swim:      { code: 'SW', name: 'Swim',         desc: 'Swimming session — cross-training.',                                       color: C.teal },
	ski:       { code: 'SK', name: 'Ski',          desc: 'Skiing session — cross-training.',                                         color: C.teal },
	yoga:      { code: 'YG', name: 'Yoga',         desc: 'Yoga / mobility session.',                                                 color: C.teal },
	training:  { code: 'TR', name: 'Training',     desc: 'Training session.',                                                        color: C.textSecondary },
} as const satisfies Record<string, Badge>;

const SPORT_TO_BADGE: Record<string, Badge> = {
	strength_training: BADGES.strength,
	yoga: BADGES.yoga,
	indoor_cardio: BADGES.cardio,
	cardio_training: BADGES.cardio,
	hiking: BADGES.hike,
	walking: BADGES.walk,
	cycling: BADGES.cycle,
	indoor_cycling: BADGES.cycle,
	swimming: BADGES.swim,
	open_water_swimming: BADGES.swim,
	resort_skiing: BADGES.ski,
	backcountry_skiing: BADGES.ski,
};

// Match Garmin's structured TE/phrase string. Order matters: narrower buckets
// (THRESHOLD, ANAEROBIC) come before broader ones (SPEED, BASE) so e.g. an
// "ANAEROBIC_THRESHOLD" tag doesn't get caught by the SPEED rule.
function fromLabel(label: string): Badge {
	const l = label.toUpperCase();
	if (l.includes('REST')) return BADGES.rest;
	if (l.includes('STRENGTH')) return BADGES.strength;
	if (l.includes('RECOVERY')) return BADGES.recovery;
	if (l.includes('THRESHOLD')) return BADGES.threshold;
	if (l.includes('TEMPO')) return BADGES.tempo;
	if (l.includes('ANAEROBIC')) return BADGES.anaerobic;
	if (l.includes('VO2')) return BADGES.vo2;
	if (l.includes('SPRINT') || l.includes('SPEED')) return BADGES.speed;
	if (l.includes('INTERVAL')) return BADGES.interval;
	if (l.includes('LONG')) return BADGES.long;
	if (l.includes('BASE') || l.includes('AEROBIC') || l.includes('EASY')) return BADGES.base;
	return BADGES.training;
}

function fromTitle(title: string): Badge | null {
	const t = title.toLowerCase();
	if (/^rest\b|day off/.test(t)) return BADGES.rest;
	if (/strength/.test(t)) return BADGES.strength;
	if (/recovery|easy/.test(t)) return BADGES.recovery;
	if (/threshold/.test(t)) return BADGES.threshold;
	if (/tempo/.test(t)) return BADGES.tempo;
	if (/anaerobic/.test(t)) return BADGES.anaerobic;
	if (/vo2/.test(t)) return BADGES.vo2;
	if (/sprint|speed/.test(t)) return BADGES.speed;
	if (/interval/.test(t)) return BADGES.interval;
	if (/long/.test(t)) return BADGES.long;
	if (/base/.test(t)) return BADGES.base;
	return null;
}

/** Pretty-print a Garmin phrase like "ANAEROBIC_CAPACITY" → "Anaerobic Capacity". */
export function prettyPhrase(phrase: string): string {
	return phrase.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Badge for a completed activity. Sport type takes precedence over Garmin's
 * `training_effect_label` (which is HR-derived and useless for non-running
 * sessions — strength sessions get tagged "AEROBIC_BASE" or
 * "ANAEROBIC_CAPACITY" depending on HR drift, neither of which describes the
 * workout). Returns null only when neither sport nor label are recognized.
 */
export function activityBadge(activity: Activity): Badge | null {
	const sport = SPORT_TO_BADGE[activity.activity_type];
	if (sport) return sport;
	if (!activity.training_effect_label) return null;
	return fromLabel(activity.training_effect_label);
}

/**
 * Color for a Training Effect value (0.0–5.0+) on Garmin's scale:
 *   < 1.0 = no effect          → dim
 *   1.0–1.9 = minor benefit    → cyan
 *   2.0–2.9 = maintaining      → blue
 *   3.0–3.9 = improving        → green
 *   4.0–4.9 = highly improving → orange
 *   ≥ 5.0   = overreaching     → red
 */
export function teValueColor(te: number): string {
	if (te >= 5.0) return C.red;
	if (te >= 4.0) return C.orange;
	if (te >= 3.0) return C.green;
	if (te >= 2.0) return C.blue;
	if (te >= 1.0) return C.cyan;
	return C.textDim;
}

/**
 * Badge for a scheduled workout from the calendar. Phrase is Garmin's
 * structured tag (preferred); title is the human label (used when phrase is
 * missing — e.g. user-created workouts before coach details have been
 * fetched). When phrase matches, the badge name is the prettified phrase so
 * narrow tags like "ANAEROBIC_CAPACITY" surface as "Anaerobic Capacity"
 * rather than the generic "Anaerobic".
 */
export function workoutBadge(phrase: string | null, title: string | null): Badge | null {
	if (phrase) {
		const base = fromLabel(phrase);
		// Phrases we can't classify (e.g. "UNKNOWN") land on the generic
		// `training` fallback. Garmin ships some of these with a descriptive
		// title like "Base" or "Long Run" — try the title heuristic before
		// giving up so they don't all collapse to "TR Training".
		if (base === BADGES.training) {
			const fromName = title ? fromTitle(title) : null;
			if (fromName) return fromName;
		}
		// Strength / rest / training phrases keep the static name; everything
		// else gets the prettified phrase so the user sees Garmin's exact
		// category (e.g. "ANAEROBIC_CAPACITY" → "Anaerobic Capacity").
		if (base === BADGES.strength || base === BADGES.rest || base === BADGES.training) return base;
		return { ...base, name: prettyPhrase(phrase) };
	}
	if (title) return fromTitle(title);
	return null;
}

