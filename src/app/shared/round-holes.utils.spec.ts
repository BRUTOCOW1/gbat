import {
  backNineStart,
  getRoundHoleRange,
  inferHolesMode,
  isHoleInRound,
  resolveRoundHolesFromMode,
  roundHoleScopeLabel,
} from './round-holes.utils';

describe('round-holes.utils', () => {
  it('front nine is holes 1-9', () => {
    const scope = { holesPlanned: 9, holesStart: 1, courseHoleCount: 18 };
    expect(getRoundHoleRange(scope)).toEqual({ start: 1, end: 9, count: 9 });
    expect(isHoleInRound(9, scope)).toBe(true);
    expect(isHoleInRound(10, scope)).toBe(false);
  });

  it('back nine is last 9 holes', () => {
    const start = backNineStart(18);
    const scope = { holesPlanned: 9, holesStart: start, courseHoleCount: 18 };
    expect(getRoundHoleRange(scope)).toEqual({ start: 10, end: 18, count: 9 });
    expect(isHoleInRound(9, scope)).toBe(false);
    expect(isHoleInRound(10, scope)).toBe(true);
  });

  it('custom 14 hides holes 15-18', () => {
    const scope = { holesPlanned: 14, holesStart: 1, courseHoleCount: 18 };
    expect(getRoundHoleRange(scope)).toEqual({ start: 1, end: 14, count: 14 });
    expect(isHoleInRound(14, scope)).toBe(true);
    expect(isHoleInRound(15, scope)).toBe(false);
  });

  it('resolves back nine mode', () => {
    const resolved = resolveRoundHolesFromMode('back9', 18);
    expect(resolved).toEqual({ holes_planned: 9, holes_start: 10 });
    expect(inferHolesMode({ ...resolved, courseHoleCount: 18 })).toBe('back9');
    expect(roundHoleScopeLabel({ ...resolved, courseHoleCount: 18 })).toBe('holes 10–18');
  });
});
