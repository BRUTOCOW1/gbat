import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { DiagramPoint } from '../diagram-editor/diagram-editor.utils';
import {
  HoleLayoutFeature,
  HoleLayoutV1,
  polygonToSvgPoints,
} from '../../shared/models/hole-layout.model';

export interface HoleDiagramTap {
  x: number;
  y: number;
}

@Component({
  selector: 'app-hole-diagram-viewer',
  templateUrl: './hole-diagram-viewer.component.html',
  styleUrls: ['./hole-diagram-viewer.component.css'],
})
export class HoleDiagramViewerComponent {
  /** Published hole layout only — parent must not pass generic templates. */
  @Input({ required: true }) layout!: HoleLayoutV1;
  @Input() landingMarker: DiagramPoint | null = null;
  @Output() diagramTap = new EventEmitter<HoleDiagramTap>();

  readonly featureOrder: HoleLayoutFeature['kind'][] = [
    'rough',
    'fairway',
    'water',
    'bunker',
    'green',
    'tee',
  ];

  viewBox(): string {
    return `0 0 ${this.layout.viewWidth} ${this.layout.viewHeight}`;
  }

  sortedFeatures(): HoleLayoutFeature[] {
    const rank = (k: HoleLayoutFeature['kind']) => this.featureOrder.indexOf(k);
    return [...this.layout.features].sort((a, b) => rank(a.kind) - rank(b.kind));
  }

  featureClass(kind: HoleLayoutFeature['kind']): string {
    return `hole-feature hole-feature--${kind}`;
  }

  pointsAttr(feature: HoleLayoutFeature): string {
    return polygonToSvgPoints(feature.points);
  }

  onSvgTap(event: PointerEvent, svg: Element): void {
    const svgEl = svg as SVGSVGElement;
    const pt = svgEl.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    this.landingMarker = { x: local.x, y: local.y };
    this.diagramTap.emit({ x: local.x, y: local.y });
    event.preventDefault();
  }
}
