import { GolfShot } from '../shared/models/golf-shot.model';
import {
  SHOT_STORY_STRIKE_FEEL,
  ShotStory,
} from '../shared/models/shot-story.model';

const STRIKE_FEEL_TO_LEGACY: Record<string, { contact: string; severity: number }> = {
  Pure: { contact: 'Flush', severity: 92 },
  Solid: { contact: 'Flush', severity: 75 },
  OK: { contact: 'Flush', severity: 55 },
  Thin: { contact: 'Thin', severity: 12 },
  Fat: { contact: 'Heavy', severity: 35 },
};

export function emptyShotStory(): ShotStory {
  return { version: 1 };
}

/** Read story from jsonb, backfilling from legacy columns when needed. */
export function readShotStory(shot: Partial<GolfShot>): ShotStory {
  const raw = shot.shot_story;
  const base: ShotStory =
    raw && typeof raw === 'object' && (raw as ShotStory).version === 1
      ? { ...(raw as ShotStory) }
      : emptyShotStory();

  if (!base.trajectory && shot.trajectory) base.trajectory = shot.trajectory;
  if (!base.shape && shot.shape) base.shape = shot.shape;

  if (!base.strike_feel && shot.contact_severity != null) {
    const feel = SHOT_STORY_STRIKE_FEEL.find(
      (f) => STRIKE_FEEL_TO_LEGACY[f]?.severity === nearestFeelSeverity(shot.contact_severity!)
    );
    if (feel) base.strike_feel = feel;
  }
  if (!base.impact_face && shot.impact_location) {
    base.impact_face = shot.impact_location === 'Top' ? 'High' : shot.impact_location;
  }

  return base;
}

function nearestFeelSeverity(c: number): number {
  const steps = Object.values(STRIKE_FEEL_TO_LEGACY).map((x) => x.severity);
  return steps.reduce((a, b) => (Math.abs(b - c) < Math.abs(a - c) ? b : a));
}

export function writeShotStory(shot: Partial<GolfShot>, story: ShotStory): void {
  const cleaned = pruneStory(story);
  shot.shot_story = Object.keys(cleaned).length > 1 ? cleaned : undefined;
  syncLegacyFields(shot, cleaned);
}

function pruneStory(story: ShotStory): ShotStory {
  const out: ShotStory = { version: 1 };
  if (story.techniques?.length) out.techniques = [...story.techniques];
  if (story.trajectory) out.trajectory = story.trajectory;
  if (story.shape) out.shape = story.shape;
  if (story.carry_vs_plan) out.carry_vs_plan = story.carry_vs_plan;
  if (story.ground_plan) out.ground_plan = story.ground_plan;
  if (story.ground_actual) out.ground_actual = story.ground_actual;
  if (story.landing_terrain) out.landing_terrain = story.landing_terrain;
  if (story.strike_feel) out.strike_feel = story.strike_feel;
  if (story.impact_face) out.impact_face = story.impact_face;
  if (story.note?.trim()) out.note = story.note.trim();
  return out;
}

export function syncLegacyFields(shot: Partial<GolfShot>, story: ShotStory): void {
  const techniques = story.techniques ?? [];

  if (story.trajectory) {
    shot.trajectory = story.trajectory;
  } else if (techniques.some((t) => ['Punch', 'Knockdown', 'Stinger'].includes(t))) {
    shot.trajectory = 'Low';
  } else {
    shot.trajectory = 'Normal';
  }

  if (story.shape) {
    shot.shape = story.shape;
  } else {
    shot.shape = 'Straight';
  }

  if (story.carry_vs_plan === 'Flew long') {
    const dir = shot.result_direction || '';
    if (!dir || dir === 'On line' || dir === 'Straight') {
      shot.result_direction = 'Long';
    }
  } else if (story.carry_vs_plan === 'Flew short') {
    const dir = shot.result_direction || '';
    if (!dir || dir === 'On line' || dir === 'Straight') {
      shot.result_direction = 'Short';
    }
  }

  if (!story.ground_actual || story.ground_actual === 'As planned') {
    shot.result_quality = undefined;
  } else if (story.ground_actual === 'Stuck') {
    shot.result_quality = 'Stuck on slope';
  } else if (story.ground_actual === 'No release') {
    shot.result_quality = 'No release';
  } else {
    shot.result_quality = story.ground_actual;
  }

  if (story.strike_feel) {
    const leg = STRIKE_FEEL_TO_LEGACY[story.strike_feel];
    if (leg) {
      shot.contact = leg.contact;
      shot.contact_severity = leg.severity;
    }
  }

  if (story.impact_face) {
    shot.impact_location = story.impact_face === 'High' ? 'Top' : story.impact_face;
  }
}

export function toggleTechnique(story: ShotStory, tech: string): ShotStory {
  const list = [...(story.techniques ?? [])];
  const i = list.indexOf(tech);
  if (i >= 0) list.splice(i, 1);
  else list.push(tech);
  return { ...story, techniques: list.length ? list : undefined };
}

export function hasStoryContent(story: ShotStory): boolean {
  return (
    !!story.techniques?.length ||
    !!story.trajectory ||
    !!story.shape ||
    !!story.carry_vs_plan ||
    !!story.ground_plan ||
    !!story.ground_actual ||
    !!story.landing_terrain ||
    !!story.strike_feel ||
    !!story.impact_face ||
    !!story.note?.trim()
  );
}

/** Narrative line for entry banner and shot cards. */
export function buildShotStorySummary(shot: Partial<GolfShot>, story?: ShotStory): string {
  const s = story ?? readShotStory(shot);
  if (!hasStoryContent(s)) {
    return '';
  }

  const parts: string[] = [];

  if (s.techniques?.length) {
    parts.push(s.techniques.join(' · '));
  }

  const air: string[] = [];
  if (s.trajectory && s.trajectory !== 'Normal') air.push(s.trajectory.toLowerCase());
  if (s.shape && s.shape !== 'Straight') air.push(s.shape.toLowerCase());
  if (s.carry_vs_plan && s.carry_vs_plan !== 'On plan' && s.carry_vs_plan !== 'Right distance') {
    air.push(s.carry_vs_plan.toLowerCase());
  }
  if (air.length) parts.push(air.join(', '));

  const ground: string[] = [];
  if (s.ground_plan) ground.push(`planned ${s.ground_plan.toLowerCase()}`);
  if (s.ground_actual && s.ground_actual !== 'As planned') {
    ground.push(s.ground_actual.toLowerCase());
  }
  if (s.landing_terrain) {
    const t = s.landing_terrain.toLowerCase();
    ground.push(t.startsWith('on ') ? t : `on ${t}`);
  }
  if (ground.length) parts.push(ground.join('; '));

  if (s.strike_feel && s.strike_feel !== 'OK' && s.strike_feel !== 'Solid' && s.strike_feel !== 'Pure') {
    parts.push(s.strike_feel.toLowerCase());
  } else if (s.impact_face && s.impact_face !== 'Center') {
    parts.push(s.impact_face.toLowerCase());
  }

  if (s.note?.trim()) parts.push(s.note.trim());

  return parts.join(' — ');
}
