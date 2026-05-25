import { buildShotStorySummary, readShotStory, writeShotStory } from './shot-story.utils';
import { GolfShot } from '../shared/models/golf-shot.model';

describe('shot-story.utils', () => {
  it('builds summary for punch draw bump-and-run that stuck on upslope', () => {
    const shot: Partial<GolfShot> = {
      shot_type: 'Chip',
      result_direction: 'Long',
    };
    writeShotStory(shot, {
      version: 1,
      techniques: ['Punch', 'Bump & run'],
      trajectory: 'Low',
      shape: 'Draw',
      carry_vs_plan: 'Flew long',
      ground_plan: 'Bump & run',
      ground_actual: 'Stuck',
      landing_terrain: 'Upslope',
      note: 'short of green on upslope',
    });

    const summary = buildShotStorySummary(shot);
    expect(summary).toContain('Punch');
    expect(summary).toContain('Draw');
    expect(summary).toContain('Bump & run');
    expect(summary).toContain('flew long');
    expect(summary).toContain('stuck');
    expect(summary).toContain('upslope');
    expect(shot.trajectory).toBe('Low');
    expect(shot.shape).toBe('Draw');
    expect(shot.result_direction).toBe('Long');
    expect(shot.result_quality).toBe('Stuck on slope');
  });

  it('backfills story from legacy columns', () => {
    const shot: Partial<GolfShot> = {
      trajectory: 'High',
      shape: 'Fade',
      contact_severity: 92,
      impact_location: 'Center',
    };
    const story = readShotStory(shot);
    expect(story.trajectory).toBe('High');
    expect(story.shape).toBe('Fade');
    expect(story.strike_feel).toBe('Pure');
  });
});
