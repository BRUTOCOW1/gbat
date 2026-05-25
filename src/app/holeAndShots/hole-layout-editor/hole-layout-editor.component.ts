import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { clientToSvg, DiagramPoint } from '../diagram-editor/diagram-editor.utils';
import {
  cloneLayout,
  hitTestFeatureIndex,
  HoleFeatureKind,
  HoleLayoutFeature,
  HoleLayoutTemplateId,
  HoleLayoutV1,
  HOLE_LAYOUT_TEMPLATE_OPTIONS,
  parseHoleLayout,
  polygonToSvgPoints,
  starterHoleLayout,
} from '../../shared/models/hole-layout.model';

export type EditorTool =
  | 'select'
  | 'draw'
  | 'move-tee'
  | 'move-pin';

export interface HoleLayoutSaveEvent {
  layout: HoleLayoutV1;
  status: 'draft' | 'published';
}

@Component({
  selector: 'app-hole-layout-editor',
  templateUrl: './hole-layout-editor.component.html',
  styleUrls: [
    './hole-layout-editor.component.css',
    '../hole-diagram/hole-diagram-viewer.component.css',
  ],
})
export class HoleLayoutEditorComponent implements OnChanges {
  @Input() par = 4;
  @Input() initialLayout: unknown = null;
  @Input() saving = false;
  @Output() save = new EventEmitter<HoleLayoutSaveEvent>();

  readonly templateOptions = HOLE_LAYOUT_TEMPLATE_OPTIONS;
  readonly drawKinds: HoleFeatureKind[] = [
    'fairway',
    'rough',
    'green',
    'bunker',
    'water',
    'tee',
  ];

  layout!: HoleLayoutV1;
  tool: EditorTool = 'select';
  drawKind: HoleFeatureKind = 'fairway';
  draftPoints: DiagramPoint[] = [];
  selectedFeatureIndex: number | null = null;
  selectedTemplate: HoleLayoutTemplateId = 'straight';

  private drag:
    | { kind: 'vertex'; featureIdx: number; vertexIdx: number }
    | { kind: 'tee' }
    | { kind: 'pin' }
    | null = null;

  readonly featureOrder: HoleFeatureKind[] = [
    'rough',
    'fairway',
    'water',
    'bunker',
    'green',
    'tee',
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialLayout'] || changes['par']) {
      this.resetFromInput();
    }
  }

  ngOnInit(): void {
    if (!this.layout) this.resetFromInput();
  }

  private resetFromInput(): void {
    const parsed = parseHoleLayout(this.initialLayout);
    this.layout = parsed ?? starterHoleLayout(this.par, 'straight');
    this.selectedTemplate =
      this.layout.meta?.template ?? 'straight';
    this.draftPoints = [];
    this.selectedFeatureIndex = null;
  }

  viewBox(): string {
    return `0 0 ${this.layout.viewWidth} ${this.layout.viewHeight}`;
  }

  sortedFeatures(): HoleLayoutFeature[] {
    const rank = (k: HoleFeatureKind) => this.featureOrder.indexOf(k);
    return [...this.layout.features].sort((a, b) => rank(a.kind) - rank(b.kind));
  }

  featureClass(kind: HoleFeatureKind): string {
    return `hole-feature hole-feature--${kind}`;
  }

  pointsAttr(feature: HoleLayoutFeature): string {
    return polygonToSvgPoints(feature.points);
  }

  setTool(t: EditorTool): void {
    this.tool = t;
    if (t !== 'draw') this.draftPoints = [];
  }

  setDrawKind(kind: HoleFeatureKind): void {
    this.drawKind = kind;
    this.tool = 'draw';
    this.draftPoints = [];
  }

  applyStarterTemplate(): void {
    if (
      !confirm(
        'Replace the current diagram with this starter? Unsaved edits will be lost.'
      )
    ) {
      return;
    }
    this.layout = starterHoleLayout(this.par, this.selectedTemplate);
    this.draftPoints = [];
    this.selectedFeatureIndex = null;
  }

  closeDraftShape(): void {
    if (this.draftPoints.length < 3) return;
    this.layout.features.push({
      kind: this.drawKind,
      label: this.drawKind,
      points: this.draftPoints.map((p) => ({ ...p })),
    });
    this.draftPoints = [];
  }

  undoDraftPoint(): void {
    this.draftPoints.pop();
  }

  deleteSelectedFeature(): void {
    if (this.selectedFeatureIndex == null) return;
    this.layout.features.splice(this.selectedFeatureIndex, 1);
    this.selectedFeatureIndex = null;
  }

  emitSave(status: 'draft' | 'published'): void {
    this.save.emit({ layout: cloneLayout(this.layout), status });
  }

  onSvgPointerDown(event: PointerEvent, svg: Element): void {
    const svgEl = svg as SVGSVGElement;
    const target = event.target as Element;

    const vh = target.closest('.layout-vertex');
    if (vh && this.selectedFeatureIndex != null) {
      const featureIdx = Number(vh.getAttribute('data-fidx'));
      const vertexIdx = Number(vh.getAttribute('data-vidx'));
      if (Number.isFinite(featureIdx) && Number.isFinite(vertexIdx)) {
        this.drag = { kind: 'vertex', featureIdx, vertexIdx };
        vh.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
      return;
    }

    const pt = clientToSvg(svgEl, event.clientX, event.clientY);

    if (this.tool === 'move-tee') {
      this.layout.tee = { x: pt.x, y: pt.y };
      this.syncTeePolygon();
      event.preventDefault();
      return;
    }
    if (this.tool === 'move-pin') {
      this.layout.pin = { x: pt.x, y: pt.y };
      event.preventDefault();
      return;
    }
    if (this.tool === 'draw') {
      this.draftPoints.push({ x: pt.x, y: pt.y });
      event.preventDefault();
      return;
    }

    const hit = hitTestFeatureIndex(this.layout, pt);
    this.selectedFeatureIndex = hit;
    event.preventDefault();
  }

  onSvgPointerMove(event: PointerEvent, svg: Element): void {
    if (!this.drag) return;
    const pt = clientToSvg(svg as SVGSVGElement, event.clientX, event.clientY);
    if (this.drag.kind === 'vertex') {
      const f = this.layout.features[this.drag.featureIdx];
      if (f) {
        f.points[this.drag.vertexIdx] = { x: pt.x, y: pt.y };
      }
    }
    event.preventDefault();
  }

  onSvgPointerUp(event: PointerEvent): void {
    if (this.drag) {
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      this.drag = null;
    }
  }

  private syncTeePolygon(): void {
    const teeFeature = this.layout.features.find((f) => f.kind === 'tee');
    if (!teeFeature) return;
    const t = this.layout.tee;
    teeFeature.points = [
      { x: t.x - 6, y: t.y - 4 },
      { x: t.x + 6, y: t.y - 4 },
      { x: t.x + 6, y: t.y + 6 },
      { x: t.x - 6, y: t.y + 6 },
    ];
  }

  selectedFeature(): HoleLayoutFeature | null {
    if (this.selectedFeatureIndex == null) return null;
    return this.layout.features[this.selectedFeatureIndex] ?? null;
  }

  isFeatureSelected(sortedIndex: number): boolean {
    const f = this.sortedFeatures()[sortedIndex];
    const idx = this.layout.features.indexOf(f);
    return idx === this.selectedFeatureIndex;
  }

  featureIndexInLayout(feature: HoleLayoutFeature): number {
    return this.layout.features.indexOf(feature);
  }

  draftPreviewPoints(): string {
    if (!this.draftPoints.length) return '';
    return polygonToSvgPoints(this.draftPoints);
  }
}
