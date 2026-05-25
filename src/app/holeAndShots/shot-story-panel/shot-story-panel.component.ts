import { Component, Input, OnInit } from '@angular/core';
import { GolfShot } from '../../shared/models/golf-shot.model';
import {
  SHOT_STORY_CARRY_VS_PLAN,
  SHOT_STORY_GROUND_ACTUAL_COMMON,
  SHOT_STORY_GROUND_ACTUAL_MORE,
  SHOT_STORY_GROUND_PLAN_COMMON,
  SHOT_STORY_GROUND_PLAN_MORE,
  SHOT_STORY_IMPACT_FACE,
  SHOT_STORY_LANDING_TERRAIN_COMMON,
  SHOT_STORY_LANDING_TERRAIN_MORE,
  SHOT_STORY_SHAPES,
  SHOT_STORY_STRIKE_FEEL,
  SHOT_STORY_TABS,
  SHOT_STORY_TECHNIQUES_COMMON,
  SHOT_STORY_TECHNIQUES_MORE,
  SHOT_STORY_TRAJECTORIES,
  ShotStory,
  ShotStoryLayerId,
} from '../../shared/models/shot-story.model';
import {
  buildShotStorySummary,
  hasStoryContent,
  readShotStory,
  toggleTechnique,
  writeShotStory,
} from '../shot-story.utils';

@Component({
  selector: 'app-shot-story-panel',
  templateUrl: './shot-story-panel.component.html',
  styleUrls: ['./shot-story-panel.component.css'],
})
export class ShotStoryPanelComponent implements OnInit {
  @Input({ required: true }) shot!: GolfShot;
  @Input() compact = false;

  readonly tabs = SHOT_STORY_TABS;
  readonly techniquesCommon = SHOT_STORY_TECHNIQUES_COMMON;
  readonly techniquesMore = SHOT_STORY_TECHNIQUES_MORE;
  readonly trajectories = SHOT_STORY_TRAJECTORIES;
  readonly shapes = SHOT_STORY_SHAPES;
  readonly carryVsPlan = SHOT_STORY_CARRY_VS_PLAN;
  readonly groundPlanCommon = SHOT_STORY_GROUND_PLAN_COMMON;
  readonly groundPlanMore = SHOT_STORY_GROUND_PLAN_MORE;
  readonly groundActualCommon = SHOT_STORY_GROUND_ACTUAL_COMMON;
  readonly groundActualMore = SHOT_STORY_GROUND_ACTUAL_MORE;
  readonly landingTerrainCommon = SHOT_STORY_LANDING_TERRAIN_COMMON;
  readonly landingTerrainMore = SHOT_STORY_LANDING_TERRAIN_MORE;
  readonly strikeFeel = SHOT_STORY_STRIKE_FEEL;
  readonly impactFace = SHOT_STORY_IMPACT_FACE;

  activeTab: ShotStoryLayerId = 'play';
  panelOpen = false;
  showMoreTechniques = false;
  showMoreGroundPlan = false;
  showMoreGroundActual = false;
  showMoreTerrain = false;

  ngOnInit(): void {
    if (this.hasContent() || !this.compact) {
      this.panelOpen = true;
    }
  }

  get story(): ShotStory {
    return readShotStory(this.shot);
  }

  summary(): string {
    return buildShotStorySummary(this.shot);
  }

  hasContent(): boolean {
    return hasStoryContent(this.story);
  }

  togglePanel(): void {
    this.panelOpen = !this.panelOpen;
  }

  selectTab(id: ShotStoryLayerId): void {
    this.activeTab = id;
  }

  tabActive(id: ShotStoryLayerId): boolean {
    return this.activeTab === id;
  }

  tabHasValue(id: ShotStoryLayerId): boolean {
    const s = this.story;
    switch (id) {
      case 'play':
        return !!(
          s.techniques?.length ||
          (s.trajectory && s.trajectory !== 'Normal') ||
          (s.shape && s.shape !== 'Straight')
        );
      case 'air':
        return !!s.carry_vs_plan && s.carry_vs_plan !== 'On plan' && s.carry_vs_plan !== 'Right distance';
      case 'ground':
        return !!(s.ground_plan || s.ground_actual || s.landing_terrain);
      case 'strike':
        return !!(
          s.strike_feel ||
          (s.impact_face && s.impact_face !== 'Center')
        );
      case 'note':
        return !!s.note?.trim();
      default:
        return false;
    }
  }

  private patch(partial: Partial<ShotStory>): void {
    writeShotStory(this.shot, { ...this.story, ...partial });
  }

  isTechniqueActive(tech: string): boolean {
    return (this.story.techniques ?? []).includes(tech);
  }

  toggleTechniqueChip(tech: string): void {
    writeShotStory(this.shot, toggleTechnique(this.story, tech));
  }

  pickSingle(field: keyof ShotStory, value: string): void {
    const current = this.story[field];
    const next = current === value ? undefined : value;
    this.patch({ [field]: next } as Partial<ShotStory>);
  }

  isSingleActive(field: keyof ShotStory, value: string): boolean {
    return (this.story[field] as string | undefined) === value;
  }

  onNoteInput(value: string): void {
    this.patch({ note: value || undefined });
  }

  clearStory(): void {
    this.shot.shot_story = undefined;
    this.shot.trajectory = 'Normal';
    this.shot.shape = 'Straight';
    this.shot.contact = 'Flush';
    this.shot.impact_location = 'Center';
    this.shot.contact_severity = 55;
    this.shot.result_quality = undefined;
    this.activeTab = 'play';
    this.panelOpen = false;
  }
}
