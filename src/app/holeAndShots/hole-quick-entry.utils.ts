import { GolfShot } from '../shared/models/golf-shot.model';

/** Golfer bag row used for quick hole entry (golfer_club.id + display fields). */
export interface QuickGolferClub {
  id: string;
  club_id: string;
  number: string;
  category: string;
}

export interface QuickStrokeDraft {
  stroke_number: number;
  club_id: string;
  club_name: string;
  shot_type: string;
  lie: string;
  result: string;
  result_location: string;
  result_direction: string;
  landing_lateral: 'Left' | 'Center' | 'Right';
  distance: number;
  putt_length?: number;
  is_kick_in?: boolean;
}

const MIN_STROKES = 1;
const MAX_STROKES = 12;

export function quickStrokeCountBounds(): { min: number; max: number } {
  return { min: MIN_STROKES, max: MAX_STROKES };
}

export function clampQuickStrokeCount(n: number): number {
  if (!Number.isFinite(n)) {
    return 4;
  }
  return Math.min(MAX_STROKES, Math.max(MIN_STROKES, Math.round(n)));
}

export function buildQuickStrokeDrafts(
  strokeCount: number,
  clubs: QuickGolferClub[]
): QuickStrokeDraft[] {
  const count = clampQuickStrokeCount(strokeCount);
  if (!clubs.length || count < 1) {
    return [];
  }

  const drafts: QuickStrokeDraft[] = [];
  const middleClubIds = pickMiddleClubIds(Math.max(0, count - 2), clubs);

  for (let stroke = 1; stroke <= count; stroke++) {
    if (stroke === 1 && count > 1) {
      const club = findDriver(clubs) ?? clubs[0];
      drafts.push(
        buildDraft(stroke, club, {
          shot_type: 'Tee Shot',
          lie: 'Tee Box',
          result_location: 'Fairway',
        })
      );
      continue;
    }

    if (stroke === count) {
      const putter = findPutter(clubs) ?? clubs[clubs.length - 1];
      drafts.push(
        buildDraft(stroke, putter, {
          shot_type: 'Putt',
          lie: 'Green',
          result: 'Made',
          result_location: 'Made',
          putt_length: 0,
          is_kick_in: true,
        })
      );
      continue;
    }

    const midIndex = stroke - 2;
    const midClub =
      clubs.find((c) => c.id === middleClubIds[midIndex]) ??
      findApproachIron(clubs) ??
      clubs[Math.min(midIndex + 1, clubs.length - 1)];

    const isOnlyMid = count === 3 && stroke === 2;
    drafts.push(
      buildDraft(stroke, midClub, {
        shot_type: isOnlyMid ? 'Approach' : stroke === count - 1 && middleClubIds.length > 1 ? 'Chip' : 'Approach',
        lie: 'Fairway',
        result_location: stroke === count - 1 ? 'Green' : 'Fairway',
      })
    );
  }

  return drafts;
}

export function quickDraftToGolfShot(draft: QuickStrokeDraft, playedHoleId: string): GolfShot {
  return {
    hole_id: playedHoleId,
    club_id: draft.club_id,
    club_name: draft.club_name,
    distance: draft.distance,
    shot_type: draft.shot_type,
    lie: draft.lie,
    result: draft.result,
    result_location: draft.result_location,
    result_direction: draft.result_direction,
    landing_lateral: draft.landing_lateral,
    stroke_number: draft.stroke_number,
    penalty: 'none',
    penalty_strokes: 0,
    putt_length: draft.putt_length,
    is_kick_in: draft.is_kick_in ?? false,
  };
}

function buildDraft(
  stroke_number: number,
  club: QuickGolferClub,
  opts: {
    shot_type: string;
    lie: string;
    result?: string;
    result_location: string;
    putt_length?: number;
    is_kick_in?: boolean;
  }
): QuickStrokeDraft {
  const isPutt = opts.shot_type === 'Putt';
  return {
    stroke_number,
    club_id: club.id,
    club_name: `${club.number} ${club.category}`.trim(),
    shot_type: opts.shot_type,
    lie: opts.lie,
    result: opts.result ?? opts.result_location,
    result_location: opts.result_location,
    result_direction: 'On line',
    landing_lateral: 'Center',
    distance: isPutt ? 0 : 0,
    putt_length: opts.putt_length,
    is_kick_in: opts.is_kick_in,
  };
}

/** Middle strokes between tee and final putt. */
function pickMiddleClubIds(middleCount: number, clubs: QuickGolferClub[]): string[] {
  if (middleCount <= 0) {
    return [];
  }
  const out: string[] = [];
  const approach = findApproachIron(clubs);
  if (approach && middleCount >= 1) {
    out.push(approach.id);
  }
  if (middleCount <= 1) {
    return out;
  }

  const wedges = findWedgesSorted(clubs);
  let wedgeIdx = 0;
  for (let i = 1; i < middleCount; i++) {
    if (wedgeIdx < wedges.length) {
      out.push(wedges[wedgeIdx].id);
      wedgeIdx++;
    } else if (approach) {
      out.push(approach.id);
    } else if (clubs.length) {
      out.push(clubs[Math.min(i, clubs.length - 1)].id);
    }
  }
  return out;
}

export function findDriver(clubs: QuickGolferClub[]): QuickGolferClub | undefined {
  return (
    clubs.find(
      (c) =>
        c.category?.toLowerCase().includes('driver') || c.number?.toLowerCase().includes('driver')
    ) ?? clubs[0]
  );
}

export function findPutter(clubs: QuickGolferClub[]): QuickGolferClub | undefined {
  return clubs.find(
    (c) =>
      c.category?.toLowerCase().includes('putter') || c.number?.toLowerCase().includes('putter')
  );
}

export function findApproachIron(clubs: QuickGolferClub[]): QuickGolferClub | undefined {
  return (
    clubs.find((c) => c.number === '7' && c.category?.toLowerCase().includes('iron')) ??
    clubs.find((c) => {
      const num = c.number || '';
      return (num === '8' || num === '9') && c.category?.toLowerCase().includes('iron');
    })
  );
}

export function findWedgesSorted(clubs: QuickGolferClub[]): QuickGolferClub[] {
  return [...clubs]
    .filter((c) => isWedgeClub(c))
    .sort((a, b) => wedgeSortKey(a) - wedgeSortKey(b));
}

function isWedgeClub(c: QuickGolferClub): boolean {
  const cat = (c.category || '').toLowerCase();
  const num = (c.number || '').toLowerCase();
  return (
    cat.includes('wedge') ||
    cat.includes('pitching') ||
    cat.includes('gap') ||
    cat.includes('sand') ||
    cat.includes('lob') ||
    ['sw', 'gw', 'lw', 'pw', 'aw', '52', '50', '56', '58', '60'].some((w) => num.includes(w))
  );
}

function wedgeSortKey(c: QuickGolferClub): number {
  const n = (c.number || '').toUpperCase().replace(/\s+/g, '');
  const cat = (c.category || '').toLowerCase();
  if (n.includes('52')) {
    return 515;
  }
  if (n.includes('PW') || cat.includes('pitching')) {
    return 410;
  }
  if (n.includes('GW') || cat.includes('gap')) {
    return 420;
  }
  if (n.includes('SW') || cat.includes('sand')) {
    return 430;
  }
  if (n.includes('LW') || cat.includes('lob')) {
    return 440;
  }
  const loft = parseInt(n.replace(/\D/g, ''), 10);
  if (!Number.isNaN(loft) && loft >= 40 && loft <= 70) {
    return 500 + loft;
  }
  return 600;
}
