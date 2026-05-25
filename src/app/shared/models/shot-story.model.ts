/** Structured optional facets for rich shot logging (stored as `golf_shot.shot_story` jsonb). */
export interface ShotStory {
  version: 1;
  /** Multi-select: Punch, Draw, Bump & run, etc. */
  techniques?: string[];
  trajectory?: string;
  shape?: string;
  /** Carry vs what you wanted: On plan, Flew long, Flew short */
  carry_vs_plan?: string;
  /** Intended ground behavior: Bump & run, Run to green, Check up, … */
  ground_plan?: string;
  /** What happened on the ground: Stuck, No release, Ran out, … */
  ground_actual?: string;
  /** Where / how it landed: Upslope, Downslope, Firm, … */
  landing_terrain?: string;
  strike_feel?: string;
  impact_face?: string;
  /** Extra color (shown in summary + optional notes append) */
  note?: string;
}

/** Shape is on the Curve row — not duplicated here. */
export const SHOT_STORY_TECHNIQUES_COMMON = [
  'Punch',
  'Bump & run',
  'Knockdown',
  'Stinger',
  'Flop',
  'Chip & run',
  'Lay-up',
  'Full swing',
] as const;

export const SHOT_STORY_TECHNIQUES_MORE = ['Texas wedge', 'High soft', 'Low spinner'] as const;

export const SHOT_STORY_TECHNIQUES = [
  ...SHOT_STORY_TECHNIQUES_COMMON,
  ...SHOT_STORY_TECHNIQUES_MORE,
] as const;

export const SHOT_STORY_GROUND_PLAN_COMMON = [
  'Bump & run',
  'Run to green',
  'Check up',
  'Release',
] as const;

export const SHOT_STORY_GROUND_PLAN_MORE = ['Run out', 'Spin stop', 'Land soft'] as const;

export const SHOT_STORY_GROUND_ACTUAL_COMMON = [
  'As planned',
  'Stuck',
  'No release',
  'Ran through',
  'Checked',
] as const;

export const SHOT_STORY_GROUND_ACTUAL_MORE = ['Jumped', 'Skipped', 'Plugged', 'Backwards'] as const;

export const SHOT_STORY_LANDING_TERRAIN_COMMON = [
  'Upslope',
  'Downslope',
  'Flat',
  'Firm',
  'Soft',
] as const;

export const SHOT_STORY_LANDING_TERRAIN_MORE = [
  'Into slope',
  'Ball above',
  'Ball below',
  'Bald lie',
] as const;

export const SHOT_STORY_TRAJECTORIES = ['Low', 'Normal', 'High'] as const;
export const SHOT_STORY_SHAPES = ['Draw', 'Straight', 'Fade'] as const;

export const SHOT_STORY_CARRY_VS_PLAN = [
  'On plan',
  'Flew long',
  'Flew short',
  'Right distance',
] as const;

export const SHOT_STORY_GROUND_PLAN = [
  ...SHOT_STORY_GROUND_PLAN_COMMON,
  ...SHOT_STORY_GROUND_PLAN_MORE,
] as const;

export const SHOT_STORY_GROUND_ACTUAL = [
  ...SHOT_STORY_GROUND_ACTUAL_COMMON,
  ...SHOT_STORY_GROUND_ACTUAL_MORE,
] as const;

export const SHOT_STORY_LANDING_TERRAIN = [
  ...SHOT_STORY_LANDING_TERRAIN_COMMON,
  ...SHOT_STORY_LANDING_TERRAIN_MORE,
] as const;

export const SHOT_STORY_STRIKE_FEEL = [
  'Pure',
  'Solid',
  'OK',
  'Thin',
  'Fat',
] as const;

export const SHOT_STORY_IMPACT_FACE = [
  'Center',
  'Toe',
  'Heel',
  'High',
  'Sky',
] as const;

export type ShotStoryLayerId = 'play' | 'air' | 'ground' | 'strike' | 'note';

export const SHOT_STORY_TABS: { id: ShotStoryLayerId; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'air', label: 'Air' },
  { id: 'ground', label: 'Ground' },
  { id: 'strike', label: 'Strike' },
  { id: 'note', label: 'Note' },
];
