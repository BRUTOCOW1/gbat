import { GolfShot } from '../shared/models/golf-shot.model';
import { QuickGolferClub, findPutter } from './hole-quick-entry.utils';

/** Penalty procedures stored on `golf_shot.penalty` (excludes `none`). */
export type PenaltyType = Exclude<NonNullable<GolfShot['penalty']>, 'none'>;

export interface PenaltyOption {
  value: PenaltyType;
  shortLabel: string;
  strokeDelta: number;
}

export const PENALTY_OPTIONS: readonly PenaltyOption[] = [
  { value: 'drop', shortLabel: 'Drop', strokeDelta: 1 },
  { value: 'stroke_only', shortLabel: 'Stroke only', strokeDelta: 1 },
  { value: 'unplayable', shortLabel: 'Unplayable', strokeDelta: 1 },
  { value: 'stroke_and_distance', shortLabel: 'S&D', strokeDelta: 2 },
] as const;

export function getPenaltyStrokes(penalty: GolfShot['penalty'] | undefined): number {
  switch (penalty) {
    case 'stroke_only':
    case 'drop':
    case 'unplayable':
      return 1;
    case 'stroke_and_distance':
      return 2;
    default:
      return 0;
  }
}

export function penaltyLabel(p: string | undefined): string | null {
  switch (p) {
    case 'stroke_only':
      return 'Penalty: +1';
    case 'drop':
      return 'Drop: +1';
    case 'unplayable':
      return 'Unplayable: +1';
    case 'stroke_and_distance':
      return 'S&D: +2';
    case 'none':
    case undefined:
    case null:
    case '':
      return null;
    default:
      return `Penalty: ${p}`;
  }
}

export function penaltyDescription(p: PenaltyType): string {
  switch (p) {
    case 'stroke_only':
      return 'One penalty stroke (e.g. general breach where you don’t replay).';
    case 'stroke_and_distance':
      return 'Stroke and distance — replay from previous spot (+2 to your score for this procedure).';
    case 'drop':
      return 'One penalty stroke, then drop within one club-length (or rule-appropriate relief).';
    case 'unplayable':
      return 'One penalty stroke for taking an unplayable lie.';
    default:
      return '';
  }
}

/** Score for the hole: each row counts as 1 stroke plus any extra penalty strokes on that row. */
export function totalStrokesFromShots(
  shots: readonly Pick<GolfShot, 'penalty_strokes'>[]
): number {
  return shots.reduce((sum, s) => sum + 1 + (s.penalty_strokes || 0), 0);
}

/** Last shot that isn’t a penalty row — used to infer the next real swing. */
export function lastShotForInference(shots: readonly GolfShot[]): GolfShot | undefined {
  for (let i = shots.length - 1; i >= 0; i--) {
    if (shots[i].shot_type !== 'Penalty') {
      return shots[i];
    }
  }
  return shots.length ? shots[shots.length - 1] : undefined;
}

export function pickPenaltyClub(
  clubs: readonly Pick<QuickGolferClub, 'id' | 'number' | 'category'>[]
): Pick<QuickGolferClub, 'id' | 'number' | 'category'> | undefined {
  if (!clubs.length) {
    return undefined;
  }
  return findPutter(clubs as QuickGolferClub[]) ?? clubs[0];
}

export function buildPenaltyGolfShot(
  playedHoleId: string,
  strokeNumber: number,
  penaltyType: PenaltyType,
  club: Pick<QuickGolferClub, 'id' | 'number' | 'category'>
): GolfShot {
  const penaltyStrokes = getPenaltyStrokes(penaltyType);
  return {
    hole_id: playedHoleId,
    club_id: club.id,
    club_name: 'Penalty',
    distance: 0,
    shot_type: 'Penalty',
    lie: 'Fairway',
    result: 'Fairway',
    result_location: 'Fairway',
    landing_lateral: 'Center',
    result_direction: 'On line',
    stroke_number: strokeNumber,
    penalty: penaltyType,
    penalty_strokes: penaltyStrokes,
  };
}

export interface PenaltyRecordDeps {
  getPlayedHole(
    roundId: string,
    holeId: string
  ): Promise<{ data?: { id: string }[] | null; error?: unknown } | null | undefined>;
  createPlayedHole(entry: {
    round_id: string;
    hole_id: string;
    strokes: number;
  }): Promise<{ data?: { id: string }[] | null; error?: unknown }>;
  addGolfShot(shot: GolfShot): Promise<GolfShot[] | null>;
  getShotsForPlayedHole(playedHoleId: string): Promise<GolfShot[] | null | undefined>;
  updatePlayedHoleStrokes(playedHoleId: string, strokes: number): Promise<void>;
}

export type RecordPenaltyResult =
  | { ok: true; playedHoleId: string; shots: GolfShot[] }
  | { ok: false; message: string };

/** Insert a penalty row and refresh played-hole stroke total. */
export async function recordPenaltyStroke(
  deps: PenaltyRecordDeps,
  params: {
    roundId: string;
    holeId: string;
    penaltyType: PenaltyType;
    club: Pick<QuickGolferClub, 'id' | 'number' | 'category'>;
    existingPlayedHoleId?: string | null;
    existingShots?: GolfShot[];
  }
): Promise<RecordPenaltyResult> {
  const { roundId, holeId, penaltyType, club } = params;
  let playedHoleId = params.existingPlayedHoleId ?? undefined;
  let shots = params.existingShots ?? [];

  if (!playedHoleId) {
    const ph = await deps.getPlayedHole(roundId, holeId);
    playedHoleId = ph?.data?.[0]?.id;
    if (playedHoleId) {
      const data = await deps.getShotsForPlayedHole(playedHoleId);
      shots = data ?? [];
    }
  }

  const penaltyStrokes = getPenaltyStrokes(penaltyType);

  if (!playedHoleId) {
    const initialStrokes = 1 + penaltyStrokes;
    const { data: created, error } = await deps.createPlayedHole({
      round_id: roundId,
      hole_id: holeId,
      strokes: initialStrokes,
    });
    if (error || !created?.length) {
      return { ok: false, message: 'Could not start hole.' };
    }
    playedHoleId = created[0].id;
    shots = [];
  }

  const nextStroke = shots.length + 1;
  const shot = buildPenaltyGolfShot(playedHoleId, nextStroke, penaltyType, club);
  const inserted = await deps.addGolfShot(shot);
  if (!inserted) {
    return { ok: false, message: 'Could not save penalty stroke.' };
  }

  const refreshed = (await deps.getShotsForPlayedHole(playedHoleId)) ?? [];
  const totalStrokes = totalStrokesFromShots(refreshed);
  await deps.updatePlayedHoleStrokes(playedHoleId, totalStrokes);

  return { ok: true, playedHoleId, shots: refreshed };
}
