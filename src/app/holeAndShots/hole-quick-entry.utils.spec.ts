import {
  buildQuickStrokeDrafts,
  findApproachIron,
  findDriver,
  findPutter,
  QuickGolferClub,
} from './hole-quick-entry.utils';

const mockBag: QuickGolferClub[] = [
  { id: 'gc-driver', club_id: 'c1', number: '1', category: 'Driver' },
  { id: 'gc-7i', club_id: 'c2', number: '7', category: 'Iron' },
  { id: 'gc-52', club_id: 'c3', number: '52', category: 'Wedge' },
  { id: 'gc-putter', club_id: 'c4', number: 'P', category: 'Putter' },
];

describe('hole-quick-entry.utils', () => {
  it('finds driver, 7-iron, and putter in mock bag', () => {
    expect(findDriver(mockBag)?.id).toBe('gc-driver');
    expect(findApproachIron(mockBag)?.id).toBe('gc-7i');
    expect(findPutter(mockBag)?.id).toBe('gc-putter');
  });

  it('builds 4-stroke sequence: driver, 7i, 52, putter (made)', () => {
    const drafts = buildQuickStrokeDrafts(4, mockBag);
    expect(drafts).toHaveLength(4);
    expect(drafts[0].club_id).toBe('gc-driver');
    expect(drafts[0].shot_type).toBe('Tee Shot');
    expect(drafts[1].club_id).toBe('gc-7i');
    expect(drafts[2].club_id).toBe('gc-52');
    expect(drafts[3].club_id).toBe('gc-putter');
    expect(drafts[3].shot_type).toBe('Putt');
    expect(drafts[3].result).toBe('Made');
    expect(drafts[3].result_location).toBe('Made');
  });

  it('builds 3-stroke sequence: tee, approach, putt', () => {
    const drafts = buildQuickStrokeDrafts(3, mockBag);
    expect(drafts).toHaveLength(3);
    expect(drafts[0].shot_type).toBe('Tee Shot');
    expect(drafts[1].club_id).toBe('gc-7i');
    expect(drafts[2].shot_type).toBe('Putt');
  });

  it('single stroke is a made putt', () => {
    const drafts = buildQuickStrokeDrafts(1, mockBag);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].shot_type).toBe('Putt');
    expect(drafts[0].result).toBe('Made');
  });
});
