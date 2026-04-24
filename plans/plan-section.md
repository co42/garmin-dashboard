# Plan: PLAN section on the dashboard

## Goal

Add a new **PLAN** section to the homepage that appears only while an adaptive
training plan is active. Two widgets:

1. **PlanSummaryCard** — plan name, phase timeline with "you are here", race
   countdown, goal, training status.
2. **ProjectionChart** — ECharts line of the projection-time history with its
   confidence band and a goal reference line.

When no plan is active, the whole section (including its header) is hidden,
same pattern the Courses section already uses. Lands on `feat/cli-v3` (the
CLI v3 migration is already in place).

## Context

Two CLI commands feed this section. Both already exist — verified against
the installed `garmin` binary on 2026-04-23:

- `garmin coach plan --json` → active plan (header + phases + task_list).
- `garmin coach event --json [--from <d> --to <d>]` → target event
  **and** projection history in one object. With no range, `projections[]`
  contains only the most recent entry; with a range, it spans the window.

Both can fail with `{error, code: "not_found"}` when no plan/event exists;
`garminSafe` already swallows those and returns `null`.

### Actual CLI shapes (as of v3, what we observe today)

Writing this down because the shapes matter — the dashboard types mirror
them exactly after the small normalization pass below.

`coach plan` returns a single object (snake_case, but nested DTOs):

```json
{
  "training_plan_id": 45053764,
  "name": "Programme Semi 4:30",
  "start_date": "2026-04-13T00:00:00.0",
  "end_date": "2026-05-30T00:00:00.0",
  "duration_in_weeks": 7,
  "avg_weekly_workouts": 5,
  "training_status":  { "status_key":  "Scheduled" },
  "training_level":   { "level_key":   "Intermediate" },
  "training_version": { "version_name": "Pace" },
  "supplemental_sports": ["STRENGTH_TRAINING_BODYWEIGHT"],
  "phases": [
    { "start_date": "…", "end_date": "…", "training_phase": "BUILD",
      "current_phase": true }
  ],
  "task_list": [ /* per-day workouts — ignored by this plan */ ]
}
```

`coach event [--from --to]` returns:

```json
{
  "event": {
    "id": 27334883,
    "event_name": "Programme Semi 1h30",
    "event_type": "running",
    "date": "2026-05-30",
    "event_time_local": { "start_time_hh_mm": "09:00",
                          "time_zone_id": "Europe/Paris" },
    "location": "01120 Thil, France",
    "completion_target":  { "unit": "kilometer", "value": 21.1 },
    "event_customization": {
      "custom_goal":                { "unit": "second", "value": 5400.0 },
      "predicted_race_time_seconds": 5528.0,
      "projected_race_time_seconds": 5447.0,
      "is_primary_event": true,
      "training_plan_id": 45053764
    }
  },
  "plan_id": 45053764,
  "plan_name": "Programme Semi 4:30",
  "projections": [
    {
      "calendar_date": "2026-04-23",
      "predicted_race_time_seconds": 5528.0,
      "projection_race_time_seconds": 5447.0,
      "upper_bound_projection_race_time_seconds": 5513.0,
      "lower_bound_projection_race_time_seconds": 5382.0,
      "speed_prediction_mps": 3.816, "speed_projection_mps": 3.873,
      "upper_bound_projection_speed_mps": 3.827,
      "lower_bound_projection_speed_mps": 3.920,
      "event_race_predictions_feedback_phrase": "IMPROVED_VO2MAX",
      "sporting_event_id": 27334883
    }
  ]
}
```

This is the only CLI surface that hasn't been through the recent
normalization sweep (nested `*DTO`-style wrappers, `calendar_date` instead
of `date`, datetime strings where dates suffice, redundant `speed_*_mps`
fields alongside seconds). Prerequisite step (0) fixes that, then the
dashboard consumes the clean shape.

## (0) CLI prerequisite — normalize coach plan + event shapes

Small, on main, before the dashboard work starts. Target shapes after
normalization:

`coach plan`:
- `start_date` / `end_date` → strip time (`"2026-04-13"`, not
  `"2026-04-13T00:00:00.0"`).
- Flatten `training_status.status_key` → `training_status: string`.
- Flatten `training_level.level_key` → `training_level: string`.
- Flatten `training_version.version_name` → `training_version: string`.
- Rename `duration_in_weeks` → `duration_weeks` (shorter; consistent with
  the `_seconds`/`_meters` style where we omit prepositions).
- `avg_weekly_workouts` stays (accurate label; doesn't collide with
  anything).
- `phases[].start_date` / `.end_date` already date-only ✓.

`coach event`:
- Flatten `event` to top-level: `{id, name, type, date, start_time_local,
  timezone, location, distance_meters, goal_seconds,
  predicted_race_time_seconds, projected_race_time_seconds,
  is_primary_event}`.
  - `event.event_name` → `name`
  - `event.event_type` → `type`
  - `event.event_time_local.start_time_hh_mm` → `start_time_local`
  - `event.event_time_local.time_zone_id` → `timezone`
  - `event.completion_target.{unit, value}` → `distance_meters`
    (convert: if `unit == "kilometer"` then `value * 1000`; else pass-
    through meters; error on other units for now — we only see km in the
    wild).
  - `event.event_customization.custom_goal.{unit, value}` → `goal_seconds`
    (only `unit == "second"` observed; map other units if they appear).
  - `event.event_customization.predicted_race_time_seconds` → top-level.
  - `event.event_customization.projected_race_time_seconds` → top-level.
  - `event.event_customization.is_primary_event` → top-level.
- Keep `plan_id`, `plan_name`, `projections[]` as-is at top level.
- `projections[]`:
  - `calendar_date` → `date`.
  - `event_race_predictions_feedback_phrase` → `feedback_phrase`.
  - Drop the four `speed_*_mps` redundant fields (seconds + known distance
    is enough; dashboard computes pace).
  - Drop `sporting_event_id` (already in the outer `event.id`).

CLI commit on main: `refactor!: normalize coach plan/event JSON to
flat snake_case`. Tests: update the existing coach-event snapshot
tests if any; otherwise add a quick fixture-based test.

## Data model (dashboard)

`src/lib/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS daily_event_projections (
    date TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
```

Two new snapshot keys (no schema change; `snapshots` is key/value):

- `coach_plan` — full `coach plan` JSON (header + phases). `task_list`
  stripped before store — `UpcomingCard` already sources scheduled
  workouts via `calendar list`, no value in duplicating.
- `coach_event` — normalized flat event object (no `projections`, no
  `plan_id`/`plan_name` — those go back to their natural homes: history
  in the daily table, `plan_*` fields derivable from `coach_plan`).

`fullReset` list: add `'coach_plan'`, `'coach_event'` snapshot keys and
`'daily_event_projections'` table name wherever the existing fullReset
code enumerates them.

## Sync additions (`src/lib/sync.ts`)

One `coach event` call with the plan-start-to-today range gives us both
the event and full projection history. Two fetches total (plan + event).

```ts
// Coach plan + event (optional — absent for users without a plan)
const coachPlan  = await fetchOne<CoachPlanRaw>(['coach', 'plan']);
const planStart  = coachPlan?.start_date?.slice(0, 10) ?? null;
const eventBlob  = planStart
    ? await garminSafe<CoachEventBlob | null>(
          ['coach', 'event', '--from', planStart, '--to', today],
          null,
      )
    : await garminSafe<CoachEventBlob | null>(['coach', 'event'], null);
```

Assuming step (0) lands first, `CoachPlanRaw` is the same shape we want
to store minus `task_list`. Strip and store:

```ts
if (coachPlan) {
    const { task_list: _, ...planToStore } = coachPlan;
    upsertSnapshot.run('coach_plan', JSON.stringify(planToStore));
}
if (eventBlob?.event) {
    upsertSnapshot.run('coach_event', JSON.stringify(eventBlob.event));
}

// Daily projection rows (in the existing time-series block — not a
// numbered "phase", just alongside the other `upsertDaily` writes)
if (eventBlob?.projections) {
    const stmtProjections = upsertDaily('daily_event_projections');
    for (const p of eventBlob.projections) {
        stmtProjections.run(p.date, JSON.stringify(p));
    }
}
```

Bump `counts`: `projection_days: eventBlob?.projections.length ?? 0`.

`fullReset`: add the two snapshot keys and the daily table to the
existing enumerations.

## Type additions (`src/lib/types.ts`)

After step (0) lands, types mirror the CLI output directly:

```ts
export type TrainingPhaseKind = 'BUILD' | 'PEAK' | 'TAPER' | 'TARGET_EVENT_DAY';

export interface CoachPhase {
    start_date: string;                  // "2026-04-13"
    end_date: string;                    // "2026-04-29"
    training_phase: TrainingPhaseKind;
    current_phase: boolean;
}

export interface CoachPlan {
    training_plan_id: number;
    name: string;                        // "Programme Semi 4:30"
    start_date: string;                  // "2026-04-13"
    end_date: string;                    // "2026-05-30"
    duration_weeks: number;
    avg_weekly_workouts: number;
    training_status: string | null;      // "Scheduled" | "Completed" | …
    training_level: string | null;       // "Intermediate"
    training_version: string | null;     // "Pace"
    supplemental_sports: string[];
    phases: CoachPhase[];
    // task_list intentionally not stored (sync strips it before write)
}

export interface CoachEvent {
    id: number;
    name: string;                        // "Programme Semi 1h30"
    type: string;                        // "running"
    date: string;                        // "2026-05-30"
    start_time_local: string | null;     // "09:00"
    timezone: string | null;             // "Europe/Paris"
    location: string | null;             // "01120 Thil, France"
    distance_meters: number;             // 21100 (normalized from completion_target)
    goal_seconds: number | null;         // 5400 (user goal) or null
    predicted_race_time_seconds: number | null;
    projected_race_time_seconds: number | null;
    is_primary_event: boolean | null;
}

export interface EventProjection {
    date: string;                        // "2026-04-23"
    predicted_race_time_seconds: number;
    projection_race_time_seconds: number;
    upper_bound_projection_race_time_seconds: number;
    lower_bound_projection_race_time_seconds: number;
    feedback_phrase: string | null;      // "IMPROVED_VO2MAX"
}
```

`DashboardData` gains:

```ts
coachPlan: CoachPlan | null;
coachEvent: CoachEvent | null;
projectionHistory: EventProjection[];
```

Feedback-phrase → label (human-readable) is client-side since the CLI
doesn't render labels. Small map in `$lib/coach-feedback.ts`:

```ts
const LABELS: Record<string, string> = {
    IMPROVED_VO2MAX: 'Improved VO2 Max',
    IMPROVE_LONG_TERM_MILEAGE_0: 'Building mileage',
    IMPROVE_LONG_TERM_MILEAGE_1: 'Building mileage',
    IMPROVE_LONG_TERM_MILEAGE_2: 'Building mileage',
    // add as we observe new values
};

export function feedbackLabel(phrase: string | null): string {
    if (!phrase) return '';
    return LABELS[phrase] ?? phrase
        .toLowerCase().replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
```

## Loader additions (`src/lib/queries.ts`)

```ts
const coachPlan  = snapshot<CoachPlan  | null>('coach_plan',  null);
const coachEvent = snapshot<CoachEvent | null>('coach_event', null);
const projectionHistory = loadDaily<EventProjection>('daily_event_projections');
```

Return on `DashboardData`. The `snapshot<T | null>` helper already
handles missing snapshots by returning the fallback.

## Visibility rule

```svelte
<script lang="ts">
  // An active plan is one that is *not* finished or paused. Using a
  // whitelist of known "dead" statuses is more forgiving than matching
  // the single observed active value ("Scheduled"), which may vary.
  const DEAD = new Set(['Completed', 'Paused', 'Cancelled']);
  const hasPlan = $derived(
      d?.coachPlan != null &&
      d?.coachEvent != null &&
      !DEAD.has(d.coachPlan.training_status ?? '')
  );
</script>
```

`coachEvent` missing while plan status is active → still hide. The
widgets both require the event (countdown, goal, projection target).

## Components

### `PlanSummaryCard.svelte`

Contract: `{ plan: CoachPlan, event: CoachEvent, today: EventProjection | null }`.

Layout (single card, `rounded-lg bg-card p-4`):

```
┌───────────────────────────────────────────────────────────────┐
│  PLAN                                          Scheduled ◂pill │
│  Programme Semi 4:30                                          │
│                                                               │
│  ▰▰▰▰▰░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 36% · wk 2/7  │
│                                                               │
│  BUILD ─── PEAK ─── TAPER ── RACE                             │
│    ●                                                          │
│                                                               │
│  ┌─────────────┬─────────────┬─────────────┐                  │
│  │ Sat 30 May  │ 21.10 km    │ Goal        │                  │
│  │ in 37 d     │ 01120 Thil  │ 1:30:00     │                  │
│  │ 09:00 CEST  │             │ 4:16/km     │                  │
│  └─────────────┴─────────────┴─────────────┘                  │
│                                                               │
│  Projection (today): 1:30:47 · +47s vs goal                   │
└───────────────────────────────────────────────────────────────┘
```

Implementation details:

- **Phase strip is rendered from `plan.phases`, not hardcoded.** Order
  by `start_date`. Label formatter: `TARGET_EVENT_DAY` → `RACE`, others
  title-cased. Highlight the phase with `current_phase === true` via
  `C.blue`; past phases `C.textDim`; future phases `C.textDim` with an
  outline. The `●` marker sits under the `current_phase` entry.
  This handles short plans with fewer phases (no PEAK, say) and any
  future phase keys without a code change.
- **Progress bar**: `(today - plan.start_date) / (plan.end_date - plan.start_date)`
  clamped to `[0, 1]`. Week counter: `ceil(daysElapsed / 7) / duration_weeks`.
  Reuse `dates.ts::daysBetween` if it exists; otherwise add one there.
- **Countdown**: `daysBetween(today, event.date)`. Past events shouldn't
  reach an active plan, but render `"Xd ago"` defensively.
- **Goal row**: skip if `event.goal_seconds == null`. Compute pace with
  `goal_seconds / (event.distance_meters / 1000)` → `secsPerKm` → `M:SS`
  format. If a `fmtPace` helper doesn't already live in `$lib/format.ts`,
  add it there — multiple components need it now.
- **Today line**: dimmed `(projection today unavailable)` if `today` is
  null. Sign-colored delta vs goal: green if `projection < goal` (faster),
  amber if slower. Only render the delta line when `event.goal_seconds`
  exists.
- **Status pill (top right)**: `training_status` rendered via the same
  pill style as `CoachingCard.svelte`'s feedback pills. Color-code by
  status (Scheduled=blue, Completed=green, Paused=amber).

Reuse tokens from `$lib/colors.js` (C.blue / C.amber / C.green /
C.textDim) and formatters from `$lib/format.js`.

### `ProjectionChart.svelte`

Contract: `{ history: EventProjection[], event: CoachEvent, granularity: 'day'|'week' }`.

ECharts line chart, ~280px tall, same shell as `AcwrChart` / `HrvChart`.

Series:

1. **Projection** (`projection_race_time_seconds`) — solid `C.blue` line
   with markers.
2. **Confidence band** — area between
   `lower_bound_projection_race_time_seconds` and
   `upper_bound_projection_race_time_seconds`. Implementation: two line
   series, the lower as a transparent baseline, the upper with
   `areaStyle` + `stack: 'band'` such that the upper's value is `(upper -
   lower)` and the stack lands at `upper`. *Exact pattern is borrowed
   from `LoadBalanceChart.svelte` which uses the same trick; reference
   it in a code comment because it's not self-evident.*
3. **Prediction** (`predicted_race_time_seconds`) — dashed `C.teal` at
   40% opacity. Off by default via the `LEGEND_META` toggle pattern
   `AcwrChart` uses.
4. **Goal** — horizontal `markLine` at `event.goal_seconds`, `C.green`.
   **Add a `label: { formatter: 'Goal', position: 'insideEndTop' }`** —
   without the label, readers misread the line's relative position as
   "overshooting".

**Axis orientation**: y = seconds, not inverted. Lower y = faster.
Don't flip it. The goal label disambiguates what the horizontal line
means; the "line going down = getting faster" convention holds.

Y-axis formatter: `fmt_hms` from `$lib/format.js` (reuses existing
helper).

X-axis: dates, daily. When `granularity === 'week'`, bucket to Monday
entries via `weekMonday` from `$lib/dates.js`. Same pattern as
`AcwrChart`.

Tooltip: per day, show
`M:SS projection · (L:SS–U:SS band) · focus: {feedbackLabel}`. Use
`CHART_TOOLTIP` from `$lib/colors.js`.

Legend: togglable, with keys `projection`, `band`, `prediction`, `goal`.
Default-hidden: `prediction`.

**Empty state**: `history.length < 2` → render
`"Not enough projection data yet"` in dimmed text. Two points is enough
to draw a line, even if trivially.

Feedback-phrase overlay (v2, skip for first PR): a row of dots colored
by `feedback_phrase` below the X-axis, hover-to-label. Design it so the
chart contract doesn't change when it lands.

### Section wrapper in `+page.svelte`

Insert after the `<UpcomingCard />` block, before the Profile section:

```svelte
{#if hasPlan}
    <Tip text={"Your current adaptive training plan and projected race time.\nProjection = plan-adjusted. Prediction = fitness baseline."}>
        <h2 class="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">
            <Trophy size={14} weight="bold" /> Plan
        </h2>
    </Tip>

    {#key windowWeeks}
    <div class="grid gap-4 md:grid-cols-[2fr_3fr]">
        <PlanSummaryCard
            plan={d.coachPlan}
            event={d.coachEvent}
            today={d.projectionHistory.at(-1) ?? null}
        />
        <ProjectionChart
            history={d.projectionHistory.filter(p => p.date >= windowStart())}
            event={d.coachEvent}
            granularity={granularity}
        />
    </div>
    {/key}
{/if}
```

Icon: `phosphor-svelte/lib/Trophy`.

`2fr/3fr` split gives the chart the space it needs; collapses to stacked
on mobile via the existing Tailwind pattern.

The chart respects the global 1M/3M/1Y toggle via the shared
`windowStart()` filter + `granularity` derivation — same treatment as
`AcwrChart`.

## Placement

- **Above Profile**: the "am I on track?" question is the most urgent
  while a plan is active. Visible without scrolling when the plan exists.
- **Below Upcoming**: UpcomingCard lists the next workouts; PLAN gives
  the strategic context. Read order: *what's next* → *why* → *how am I
  tracking*.

## Non-goals

- Editing the plan, resetting the event, changing the goal. Dashboard
  stays read-only.
- Rendering the task list — UpcomingCard already covers scheduled
  adaptive workouts.
- Race-day weather. Out of scope.
- Historical plans / past-plan timeline. The `coach plan list`
  subcommand exists; a "past plans" section is its own design (what
  defines success? goal vs reality?).

## Acceptance checks

1. `npm run check` clean.
2. No PLAN section visible with no active plan (delete the two snapshots
   and reload).
3. PLAN section appears after a sync with a `Scheduled` plan + event.
4. Progress bar and countdown are consistent (50% elapsed ≈ race is half
   the plan duration away).
5. Phase strip reflects `plan.phases` — if a plan has 3 phases the strip
   has 3 entries, not 4.
6. Chart renders projection line + band + goal reference with label;
   legend toggles work; 1M/3M/1Y switches bucketing.
7. Plan flips to `Completed` → section hides on next sync.
8. Sign of today-delta vs goal: faster = green, slower = amber.
9. `feedback_phrase: null` doesn't crash the tooltip (label falls through
   to empty string).
10. `< 2` projections → empty-state text instead of a crash.

## Commit sequence

On `feat/cli-v3` (dashboard) and `main` (CLI):

1. *CLI* — `refactor!: normalize coach plan/event JSON to flat snake_case`.
   Reinstall (`cargo install --path . --force`).
2. *Dashboard* — `feat: PLAN section with projection chart`. Single
   commit; the components are small and cohesive enough that splitting
   doesn't help review.

## Reference

- CLI plan for the original coach-event feature:
  `~/self/garmin-cli/plans/coach-event.md`.
- Patterns to follow: `AcwrChart.svelte` (chart shell + legend toggles +
  granularity), `CoachingCard.svelte` (pill/factor layout),
  `LoadBalanceChart.svelte` (stack-band trick for the confidence area),
  Courses section in `+page.svelte` (conditional section).
