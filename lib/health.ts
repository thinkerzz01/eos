// Thinkerzz EOS - Student Health Score (locked formula)
// Master Plan v3.1 §6.1 / AGENTS.md §"Scoring". Single source of truth so the
// dashboard, the students table, and the report can never disagree.
//
//   Health = 0.50·Attendance% + 0.30·HomeworkCompletion% + 0.20·FeeTimeliness%
//
// - Attendance%        : (present + 0.5·late) / total completed classes · 100
// - HomeworkCompletion%: on-time submitted-or-graded / total assigned · 100
//                        (100 if none assigned)
// - FeeTimeliness%     : paid on/before due OR within the 3-day grace = 100;
//                        overdue/stopped = 0  (v3.1: "in grace" is fully on time)
// - Bands              : green >= 80, amber 60-79, red < 60
// - Cold start         : < 4 completed classes => "Not enough data" (excluded
//                        from at-risk). Never shown as a red 0.

export type HealthBand = 'Green' | 'Amber' | 'Red';
export type FeeStatus = 'Paid' | 'Due' | 'In Grace' | 'Stopped';

export interface HealthInputs {
  attendancePct: number;      // 0-100, already computed from attendance rows
  homeworkPct: number;        // 0-100; pass 100 when nothing was assigned
  feeStatus: FeeStatus;       // read from students.fee_status (one source)
  completedClasses: number;   // for the cold-start rule
}

export interface HealthResult {
  score: number | null;       // null when cold start (not enough data)
  band: HealthBand | null;    // null when cold start
  coldStart: boolean;
  label: string;              // display string, e.g. "92" or "Not enough data"
}

export const COLD_START_MIN_CLASSES = 4;

/** Fee timeliness sub-score. Paid or within-grace = 100, else 0. */
export function feeTimelinessScore(feeStatus: FeeStatus): number {
  return feeStatus === 'Paid' || feeStatus === 'In Grace' ? 100 : 0;
}

export function bandFor(score: number): HealthBand {
  if (score >= 80) return 'Green';
  if (score >= 60) return 'Amber';
  return 'Red';
}

export function computeHealth(i: HealthInputs): HealthResult {
  if (i.completedClasses < COLD_START_MIN_CLASSES) {
    return { score: null, band: null, coldStart: true, label: 'Not enough data' };
  }
  const raw =
    0.5 * i.attendancePct +
    0.3 * i.homeworkPct +
    0.2 * feeTimelinessScore(i.feeStatus);
  const score = Math.round(raw);
  return { score, band: bandFor(score), coldStart: false, label: String(score) };
}
