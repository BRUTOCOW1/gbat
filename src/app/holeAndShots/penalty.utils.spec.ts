import {
  buildPenaltyGolfShot,
  getPenaltyStrokes,
  lastShotForInference,
  PENALTY_OPTIONS,
  totalStrokesFromShots,
} from './penalty.utils';
import { GolfShot } from '../shared/models/golf-shot.model';

describe('penalty.utils', () => {
  it('maps penalty types to stroke counts', () => {
    expect(getPenaltyStrokes('drop')).toBe(1);
    expect(getPenaltyStrokes('stroke_and_distance')).toBe(2);
    expect(getPenaltyStrokes('none')).toBe(0);
  });

  it('sums hole score including penalty_strokes on each row', () => {
    const shots = [
      { penalty_strokes: 0 },
      { penalty_strokes: 1 },
      { penalty_strokes: 2 },
    ] as Pick<GolfShot, 'penalty_strokes'>[];
    expect(totalStrokesFromShots(shots)).toBe(6);
  });

  it('skips penalty rows when inferring previous shot', () => {
    const shots = [
      { shot_type: 'Tee Shot' } as GolfShot,
      { shot_type: 'Penalty' } as GolfShot,
    ];
    expect(lastShotForInference(shots)?.shot_type).toBe('Tee Shot');
  });

  it('builds a penalty golf shot row', () => {
    const row = buildPenaltyGolfShot('ph-1', 2, 'drop', {
      id: 'gc-p',
      number: 'P',
      category: 'Putter',
    });
    expect(row.shot_type).toBe('Penalty');
    expect(row.penalty_strokes).toBe(1);
    expect(row.club_name).toBe('Penalty');
  });

  it('exposes four quick-pick penalty options', () => {
    expect(PENALTY_OPTIONS).toHaveLength(4);
    expect(PENALTY_OPTIONS.map((o) => o.value)).toContain('drop');
  });
});
