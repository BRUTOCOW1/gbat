/** Approach distance bucket centers (yards). */
export const APPROACH_DISTANCES = [50, 75, 100, 125, 150, 175, 200] as const;

const BUCKET_HALF = 12.5;

const APPROACH_TYPES = new Set(['Approach', 'Chip']);

export interface ApproachDistanceStat {
  distanceYds: number;
  shotCount: number;
  avgStrokesToHole: number | null;
  greenHitPct: number | null;
}

export interface UserPlayerStats {
  estimatedHandicap: number | null;
  handicapSampleSize: number;
  totalRounds: number;
  roundsWithScore: number;
  avgScore: number | null;
  bestScore: number | null;
  avgPutts: number | null;
  girPct: number | null;
  firPct: number | null;
  scramblingPct: number | null;
  avgTeeDistance: number | null;
  approachByDistance: ApproachDistanceStat[];
  totalShotsLogged: number;
  holesWithShots: number;
  hasData: boolean;
}

export interface PlayerStatsRoundRow {
  id: string;
  total_strokes?: number | null;
  putts?: number | null;
  course_id?: string | null;
}

export interface PlayerStatsCourseRow {
  id: string;
  par?: number | null;
  rating?: number | null;
  slope?: number | null;
}

export interface PlayerStatsPlayedHoleRow {
  id: string;
  round_id: string;
  hole_id: string;
  strokes?: number | null;
}

export interface PlayerStatsHoleParRow {
  id: string;
  par: number;
}

type ShotLike = {
  hole_id: string;
  stroke_number: number;
  shot_type?: string | null;
  distance?: number | null;
  result_location?: string | null;
  result?: string | null;
};

function locationOf(shot: ShotLike): string {
  return shot.result_location || shot.result || '';
}

function isOnGreen(shot: ShotLike): boolean {
  const loc = locationOf(shot);
  return loc === 'Green' || loc === 'Made';
}

function isFairway(shot: ShotLike): boolean {
  return locationOf(shot) === 'Fairway';
}

function approachBucket(distance: number): number | null {
  for (const center of APPROACH_DISTANCES) {
    if (Math.abs(distance - center) <= BUCKET_HALF) {
      return center;
    }
  }
  return null;
}

/** WHS-style handicap estimate from score differentials (simplified for small samples). */
function estimateHandicap(
  rounds: PlayerStatsRoundRow[],
  courseById: Map<string, PlayerStatsCourseRow>
): { handicap: number | null; sampleSize: number } {
  const diffs: number[] = [];

  for (const round of rounds) {
    const score = Number(round.total_strokes);
    if (!score || score <= 0) {
      continue;
    }
    const course = round.course_id ? courseById.get(round.course_id) : undefined;
    const rating = course?.rating ?? course?.par ?? 72;
    const slope = course?.slope ?? 113;
    diffs.push(((score - rating) * 113) / slope);
  }

  if (!diffs.length) {
    return { handicap: null, sampleSize: 0 };
  }

  const sorted = [...diffs].sort((a, b) => a - b);
  const n = sorted.length;
  const take =
    n <= 3 ? n : n <= 5 ? 1 : n <= 8 ? 2 : n <= 14 ? 3 : n <= 19 ? 4 : 8;
  const best = sorted.slice(0, take);
  const avgDiff = best.reduce((sum, d) => sum + d, 0) / best.length;
  const handicap = Math.max(0, Math.round(avgDiff * 0.96 * 10) / 10);

  return { handicap, sampleSize: n };
}

function calculateGIR(shots: ShotLike[], par: number): boolean {
  const target = par - 2;
  if (target < 1) {
    return false;
  }
  return shots.some((s) => s.stroke_number <= target && isOnGreen(s));
}

function calculateFIR(shots: ShotLike[], par: number): boolean {
  if (par < 4 || !shots.length) {
    return false;
  }
  return isFairway(shots[0]);
}

export function computePlayerStats(
  rounds: PlayerStatsRoundRow[],
  courses: PlayerStatsCourseRow[],
  playedHoles: PlayerStatsPlayedHoleRow[],
  shots: ShotLike[],
  holePars: PlayerStatsHoleParRow[]
): UserPlayerStats {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const parByHoleId = new Map(holePars.map((h) => [h.id, h.par]));

  const shotsByPlayedHole = new Map<string, ShotLike[]>();
  for (const shot of shots) {
    const list = shotsByPlayedHole.get(shot.hole_id) ?? [];
    list.push(shot);
    shotsByPlayedHole.set(shot.hole_id, list);
  }
  for (const list of shotsByPlayedHole.values()) {
    list.sort((a, b) => a.stroke_number - b.stroke_number);
  }

  const { handicap, sampleSize } = estimateHandicap(rounds, courseById);

  const scores = rounds
    .map((r) => Number(r.total_strokes))
    .filter((s) => s > 0);
  const putts = rounds
    .map((r) => Number(r.putts))
    .filter((p) => p >= 0 && Number.isFinite(p));

  const avg = (nums: number[]) =>
    nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

  let girHits = 0;
  let girEligible = 0;
  let firHits = 0;
  let firEligible = 0;
  let scrambleHits = 0;
  let scrambleEligible = 0;
  let teeDistSum = 0;
  let teeDistCount = 0;

  const approachAccum = new Map<number, { strokes: number[]; greens: number; total: number }>();
  for (const d of APPROACH_DISTANCES) {
    approachAccum.set(d, { strokes: [], greens: 0, total: 0 });
  }

  for (const played of playedHoles) {
    const holeShots = shotsByPlayedHole.get(played.id);
    if (!holeShots?.length) {
      continue;
    }

    const par = parByHoleId.get(played.hole_id) ?? 4;
    const totalStrokes = played.strokes ?? holeShots.length;
    const gir = calculateGIR(holeShots, par);

    girEligible++;
    if (gir) {
      girHits++;
    } else {
      scrambleEligible++;
      const scoreToPar = totalStrokes - par;
      if (scoreToPar <= 0) {
        scrambleHits++;
      }
    }

    if (par >= 4) {
      firEligible++;
      if (calculateFIR(holeShots, par)) {
        firHits++;
      }
    }

    for (const shot of holeShots) {
      if (shot.shot_type === 'Tee Shot') {
        const dist = Number(shot.distance);
        if (dist > 0) {
          teeDistSum += dist;
          teeDistCount++;
        }
      }

      if (!APPROACH_TYPES.has(shot.shot_type || '')) {
        continue;
      }
      const dist = Number(shot.distance);
      if (dist <= 0) {
        continue;
      }
      const bucket = approachBucket(dist);
      if (bucket == null) {
        continue;
      }

      const acc = approachAccum.get(bucket)!;
      acc.total++;
      if (isOnGreen(shot)) {
        acc.greens++;
      }
      const strokesFromHere = totalStrokes - shot.stroke_number + 1;
      if (strokesFromHere > 0) {
        acc.strokes.push(strokesFromHere);
      }
    }
  }

  const approachByDistance: ApproachDistanceStat[] = APPROACH_DISTANCES.map((distanceYds) => {
    const acc = approachAccum.get(distanceYds)!;
    const avgStrokesToHole =
      acc.strokes.length > 0
        ? Math.round((acc.strokes.reduce((a, b) => a + b, 0) / acc.strokes.length) * 100) / 100
        : null;
    const greenHitPct =
      acc.total > 0 ? Math.round((acc.greens / acc.total) * 1000) / 10 : null;
    return {
      distanceYds,
      shotCount: acc.total,
      avgStrokesToHole,
      greenHitPct,
    };
  });

  const holesWithShots = shotsByPlayedHole.size;

  return {
    estimatedHandicap: handicap,
    handicapSampleSize: sampleSize,
    totalRounds: rounds.length,
    roundsWithScore: scores.length,
    avgScore: avg(scores),
    bestScore: scores.length ? Math.min(...scores) : null,
    avgPutts: avg(putts),
    girPct: girEligible > 0 ? Math.round((girHits / girEligible) * 1000) / 10 : null,
    firPct: firEligible > 0 ? Math.round((firHits / firEligible) * 1000) / 10 : null,
    scramblingPct:
      scrambleEligible > 0
        ? Math.round((scrambleHits / scrambleEligible) * 1000) / 10
        : null,
    avgTeeDistance: teeDistCount > 0 ? Math.round(teeDistSum / teeDistCount) : null,
    approachByDistance,
    totalShotsLogged: shots.length,
    holesWithShots,
    hasData: rounds.length > 0 || shots.length > 0,
  };
}
