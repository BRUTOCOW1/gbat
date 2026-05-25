/** Which holes belong to this round (partial rounds, front/back nine, etc.). */
export interface RoundHoleScope {
  holesPlanned: number | null;
  holesStart: number;
  courseHoleCount: number;
}

export interface RoundHoleRange {
  start: number;
  end: number;
  count: number;
}

/** First hole number of the back nine for a course (last 9 holes). */
export function backNineStart(courseHoleCount: number): number {
  return Math.max(1, courseHoleCount - 8);
}

export function getRoundHoleRange(scope: RoundHoleScope): RoundHoleRange {
  const { holesPlanned, holesStart, courseHoleCount } = scope;
  if (courseHoleCount <= 0) {
    return { start: 1, end: 0, count: 0 };
  }

  if (holesPlanned == null) {
    return { start: 1, end: courseHoleCount, count: courseHoleCount };
  }

  const start = Math.max(1, Math.min(holesStart, courseHoleCount));
  const count = Math.min(holesPlanned, courseHoleCount - start + 1);
  return { start, end: start + count - 1, count };
}

export function isHoleInRound(holeNumber: number, scope: RoundHoleScope): boolean {
  const { start, end } = getRoundHoleRange(scope);
  return holeNumber >= start && holeNumber <= end;
}

export function roundHoleScopeLabel(scope: RoundHoleScope): string {
  const { start, end, count } = getRoundHoleRange(scope);
  if (count <= 0) {
    return '';
  }
  if (scope.holesPlanned == null) {
    return `${count} holes`;
  }
  if (count === 1) {
    return `hole ${start}`;
  }
  if (start === end) {
    return `hole ${start}`;
  }
  return `holes ${start}–${end}`;
}

export type RoundHolesMode = 'full' | 'front9' | 'back9' | 'custom';

export function inferHolesMode(scope: RoundHoleScope): RoundHolesMode {
  const { holesPlanned, holesStart, courseHoleCount } = scope;
  if (holesPlanned == null) {
    return 'full';
  }
  if (holesPlanned === 9 && holesStart === 1) {
    return 'front9';
  }
  if (holesPlanned === 9 && holesStart === backNineStart(courseHoleCount)) {
    return 'back9';
  }
  return 'custom';
}

export function resolveRoundHolesFromMode(
  mode: RoundHolesMode,
  courseHoleCount: number,
  customCount?: number | null
): { holes_planned: number | null; holes_start: number } {
  if (courseHoleCount <= 0) {
    return { holes_planned: null, holes_start: 1 };
  }
  if (mode === 'full') {
    return { holes_planned: null, holes_start: 1 };
  }
  if (mode === 'front9') {
    return { holes_planned: Math.min(9, courseHoleCount), holes_start: 1 };
  }
  if (mode === 'back9') {
    return {
      holes_planned: Math.min(9, courseHoleCount),
      holes_start: backNineStart(courseHoleCount),
    };
  }
  const n = Number(customCount);
  if (!Number.isFinite(n) || n < 1) {
    return { holes_planned: Math.min(9, courseHoleCount), holes_start: 1 };
  }
  const planned = Math.min(Math.round(n), courseHoleCount);
  return { holes_planned: planned >= courseHoleCount ? null : planned, holes_start: 1 };
}
